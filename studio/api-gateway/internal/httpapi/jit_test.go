package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestJITLoadsRequestedModelOnceForConcurrentRequests(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer upstream.Close()

	s := New(Config{JITModelLoading: true, MaxIdleTTLMinutes: 60}).(*Server)
	s.jit.setInstalled([]string{"publisher/model"})
	const clients = 8
	var wg sync.WaitGroup
	results := make(chan int, clients)
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions",
				strings.NewReader(`{"model":"publisher/model","messages":[]}`))
			rec := httptest.NewRecorder()
			s.ServeHTTP(rec, req)
			results <- rec.Code
		}()
	}
	var action JITAction
	var ok bool
	for tries := 0; tries < 100; tries++ {
		action, ok = s.jit.nextAction(s.cfg, s.registry.List())
		if ok {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if !ok || action.Type != "load" || action.ModelID != "publisher/model" {
		t.Fatalf("expected one load action, got %#v, %v", action, ok)
	}
	if next, found := s.jit.nextAction(s.cfg, nil); found {
		t.Fatalf("duplicate load action: %#v", next)
	}
	if err := s.registry.Register(Worker{ModelID: action.ModelID, BaseURL: upstream.URL, JIT: true}); err != nil {
		t.Fatal(err)
	}
	s.jit.registered(action.ModelID)
	wg.Wait()
	close(results)
	for result := range results {
		if result != 200 {
			t.Errorf("request returned %d instead of 200", result)
		}
	}
}

func TestJITTimeoutProtectsActiveRequests(t *testing.T) {
	s := New(Config{JITModelLoading: true, AutoUnloadJITModels: true, MaxIdleTTLMinutes: 1}).(*Server)
	worker := Worker{ModelID: "model", BaseURL: "http://127.0.0.1:12345", JIT: true}
	if err := s.registry.Register(worker); err != nil {
		t.Fatal(err)
	}
	s.jit.registered("model")
	_, release, code, _ := s.acquire(context.Background(), "model")
	if code != 0 {
		t.Fatal(code)
	}
	s.jit.mu.Lock()
	s.jit.activity["model"].idleAt = time.Now().Add(-2 * time.Minute)
	s.jit.mu.Unlock()
	if action, found := s.jit.nextAction(s.cfg, s.registry.List()); found {
		t.Fatalf("active worker scheduled for unload: %#v", action)
	}
	release()
	s.jit.mu.Lock()
	s.jit.activity["model"].idleAt = time.Now().Add(-2 * time.Minute)
	s.jit.mu.Unlock()
	action, found := s.jit.nextAction(s.cfg, s.registry.List())
	if !found || action.Type != "unload" || action.ModelID != "model" {
		t.Fatalf("idle worker not scheduled for unload: %#v", action)
	}
}

func TestJITPreservesManualWorkersAndDisabledMode(t *testing.T) {
	s := New(Config{JITModelLoading: false, AutoUnloadJITModels: true, MaxIdleTTLMinutes: 1}).(*Server)
	if _, _, status, _ := s.acquire(context.Background(), "unloaded"); status != http.StatusNotFound {
		t.Fatalf("expected 404 for unloaded model, got %d", status)
	}
	worker := Worker{ModelID: "manual", BaseURL: "http://127.0.0.1:12345"}
	if err := s.registry.Register(worker); err != nil {
		t.Fatal(err)
	}
	s.jit.registered("manual")
	_, release, status, _ := s.acquire(context.Background(), "manual")
	if status != 0 {
		t.Fatalf("manual model was blocked: %d", status)
	}
	release()
	s.jit.mu.Lock()
	s.jit.activity["manual"].idleAt = time.Now().Add(-2 * time.Minute)
	s.jit.mu.Unlock()
	if action, found := s.jit.nextAction(s.cfg, s.registry.List()); found {
		t.Fatalf("manual model scheduled for unload: %#v", action)
	}
}

func TestJITSingleModelSwitchWaitsForActiveRequest(t *testing.T) {
	s := New(Config{JITModelLoading: true, OnlyKeepLastJITModel: true}).(*Server)
	s.jit.setInstalled([]string{"a", "b"})
	if err := s.registry.Register(Worker{ModelID: "a", BaseURL: "http://127.0.0.1:12345", JIT: true}); err != nil {
		t.Fatal(err)
	}
	s.jit.registered("a")
	_, release, status, _ := s.acquire(context.Background(), "a")
	if status != 0 {
		t.Fatal(status)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan int, 1)
	go func() {
		_, done, code, _ := s.acquire(ctx, "b")
		if done != nil {
			done()
		}
		result <- code
	}()
	time.Sleep(100 * time.Millisecond)
	if action, ok := s.jit.nextAction(s.cfg, s.registry.List()); ok {
		t.Fatalf("unload started during active request: %#v", action)
	}
	release()
	var action JITAction
	var found bool
	for tries := 0; tries < 50; tries++ {
		action, found = s.jit.nextAction(s.cfg, s.registry.List())
		if found {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !found || action.Type != "unload" || action.ModelID != "a" {
		t.Fatalf("expected previous worker to unload, got %#v", action)
	}
	s.registry.Unregister("a")
	s.jit.unregistered("a")
	for tries := 0; tries < 50; tries++ {
		action, found = s.jit.nextAction(s.cfg, s.registry.List())
		if found {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !found || action.Type != "load" || action.ModelID != "b" {
		t.Fatalf("expected next worker to load, got %#v", action)
	}
	cancel()
	<-result
}
