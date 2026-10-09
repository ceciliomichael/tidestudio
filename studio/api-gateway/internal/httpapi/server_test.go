package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestRoutingAndAuthentication(t *testing.T) {
	one := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" || r.Header.Get("x-api-key") != "" {
			t.Error("leaked credentials")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"worker":"one"}`))
	}))
	defer one.Close()
	two := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"worker":"two"}`))
	}))
	defer two.Close()
	server := New(Config{APIKey: "secret", ControlToken: "control"}).(*Server)
	for id, base := range map[string]string{"a": one.URL, "b": two.URL} {
		if err := server.registry.Register(Worker{ModelID: id, BaseURL: base}); err != nil {
			t.Fatal(err)
		}
	}
	for _, item := range []struct{ model, expected string }{{"a", "one"}, {"b", "two"}} {
		req := httptest.NewRequest("POST", "/v1/messages", strings.NewReader(`{"model":"`+item.model+`","messages":[]}`))
		req.Header.Set("x-api-key", "secret")
		w := httptest.NewRecorder()
		server.ServeHTTP(w, req)
		if w.Code != 200 || !strings.Contains(w.Body.String(), item.expected) {
			t.Fatalf("%s: %d %s", item.model, w.Code, w.Body.String())
		}
	}
	unauthorized := httptest.NewRecorder()
	server.ServeHTTP(unauthorized, httptest.NewRequest("GET", "/v1/models", nil))
	if unauthorized.Code != 401 {
		t.Fatal(unauthorized.Code)
	}
	req := httptest.NewRequest("GET", "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer secret")
	w := httptest.NewRecorder()
	server.ServeHTTP(w, req)
	var data struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil || len(data.Data) != 2 {
		t.Fatalf("bad model list: %s", w.Body.String())
	}
}

func TestControlIsolation(t *testing.T) {
	s := New(Config{ControlToken: "secret"}).(*Server)
	id := "publisher/model"
	body := `{"model_id":"publisher/model","base_url":"http://127.0.0.1:10001"}`
	req := httptest.NewRequest("PUT", "/_tidestudio/workers/"+url.PathEscape(id), strings.NewReader(body))
	req.RemoteAddr = "10.0.0.1:1234"
	req.Header.Set("X-TideStudio-Control-Token", "secret")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, req)
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
	req = httptest.NewRequest("PUT", "/_tidestudio/workers/"+url.PathEscape(id), strings.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	req.Header.Set("X-TideStudio-Control-Token", "secret")
	w = httptest.NewRecorder()
	s.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("%d: %s", w.Code, w.Body.String())
	}
	if _, ok := s.registry.Resolve(id); !ok {
		t.Fatal("not registered")
	}
}
