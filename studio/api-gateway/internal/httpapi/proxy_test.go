package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestInferenceDefaultsAreMergedWithoutOverridingRequest(t *testing.T) {
	temperature := 0.2
	topK := 10
	thinking := false
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	defer worker.Close()

	gateway := New(Config{ControlToken: "private"}).(*Server)
	if err := gateway.registry.Register(Worker{
		ModelID: "defaults-model",
		BaseURL: worker.URL,
		Defaults: InferenceDefaults{
			SystemPrompt:    "Default system prompt",
			ThinkingEnabled: &thinking,
			Temperature:     &temperature,
			TopK:            &topK,
		},
	}); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/chat/completions",
		strings.NewReader(`{
			"model":"defaults-model",
			"temperature":0.9,
			"messages":[{"role":"user","content":"hello"}]
		}`),
	)
	response := httptest.NewRecorder()
	gateway.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d %s", response.Code, response.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["temperature"] != 0.9 {
		t.Fatalf("request temperature was overwritten: %#v", body["temperature"])
	}
	if body["top_k"] != float64(10) {
		t.Fatalf("missing top-k default: %#v", body["top_k"])
	}
	messages := body["messages"].([]any)
	first := messages[0].(map[string]any)
	if first["role"] != "system" || first["content"] != "Default system prompt" {
		t.Fatalf("system prompt not applied: %#v", first)
	}
	kwargs := body["chat_template_kwargs"].(map[string]any)
	if kwargs["enable_thinking"] != false {
		t.Fatalf("thinking default not applied: %#v", kwargs)
	}
}

func TestStreamingAndCancellation(t *testing.T) {
	cancelled := make(chan struct{})
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, "data: first\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
		close(cancelled)
	}))
	defer worker.Close()

	gateway := New(Config{ControlToken: "private"}).(*Server)
	if err := gateway.registry.Register(Worker{
		ModelID: "streaming-model",
		BaseURL: worker.URL,
	}); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(gateway)
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost,
		server.URL+"/v1/responses",
		strings.NewReader(`{"model":"streaming-model","stream":true,"input":"hi"}`))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	first, err := bufio.NewReader(response.Body).ReadString('\n')
	if err != nil || first != "data: first\n" {
		t.Fatalf("first event not flushed: %q, %v", first, err)
	}

	cancel()
	select {
	case <-cancelled:
	case <-time.After(3 * time.Second):
		t.Fatal("upstream request was not cancelled")
	}
}
