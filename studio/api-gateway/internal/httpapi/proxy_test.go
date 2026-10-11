package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestInferenceDefaultsAreMergedWithoutOverridingRequest(t *testing.T) {
	temperature := 0.2
	topK := 10
	thinking := false
	reasoningBudget := 1024
	preserveReasoning := true
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
			SystemPrompt:      "Default system prompt",
			ThinkingEnabled:   &thinking,
			ReasoningBudget:   &reasoningBudget,
			ReasoningPreserve: &preserveReasoning,
			Temperature:       &temperature,
			TopK:              &topK,
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
	if kwargs["preserve_reasoning"] != true {
		t.Fatalf("reasoning-preserve default not applied: %#v", kwargs)
	}
	if body["thinking_budget_tokens"] != float64(1024) {
		t.Fatalf("reasoning budget default not applied: %#v", body["thinking_budget_tokens"])
	}
}

func TestConfiguredSystemPromptCombinesWithRequestAcrossEndpoints(t *testing.T) {
	tests := []struct {
		name, path, configured, request, want string
	}{
		{
			name:       "chat with existing system prompt",
			path:       "/v1/chat/completions",
			configured: "TideStudio rules",
			request:    `{"messages":[{"role":"system","content":"Client instructions"},{"role":"user","content":"Hi"}]}`,
			want:       `{"messages":[{"role":"system","content":"TideStudio rules\n\nClient instructions"},{"role":"user","content":"Hi"}]}`,
		},
		{
			name:       "chat without system prompt",
			path:       "/v1/chat/completions",
			configured: "TideStudio rules",
			request:    `{"messages":[{"role":"user","content":"Hi"}]}`,
			want:       `{"messages":[{"role":"system","content":"TideStudio rules"},{"role":"user","content":"Hi"}]}`,
		},
		{
			name:       "chat structured system content",
			path:       "/v1/chat/completions",
			configured: "TideStudio rules",
			request:    `{"messages":[{"role":"system","content":[{"type":"text","text":"Client rules"}]},{"role":"user","content":"Hi"}]}`,
			want:       `{"messages":[{"role":"system","content":[{"type":"text","text":"TideStudio rules"},{"type":"text","text":"Client rules"}]},{"role":"user","content":"Hi"}]}`,
		},
		{
			name:       "anthropic messages with string system",
			path:       "/v1/messages",
			configured: "TideStudio rules",
			request:    `{"system":"Client instructions","messages":[{"role":"user","content":"Hi"}]}`,
			want:       `{"system":"TideStudio rules\n\nClient instructions","messages":[{"role":"user","content":"Hi"}]}`,
		},
		{
			name:       "anthropic structured system content",
			path:       "/v1/messages",
			configured: "TideStudio rules",
			request:    `{"system":[{"type":"text","text":"Client instructions","cache_control":{"type":"ephemeral"}}]}`,
			want:       `{"system":[{"type":"text","text":"TideStudio rules"},{"type":"text","text":"Client instructions","cache_control":{"type":"ephemeral"}}]}`,
		},
		{
			name:       "anthropic count tokens",
			path:       "/v1/messages/count_tokens",
			configured: "TideStudio rules",
			request:    `{"system":"Client instructions"}`,
			want:       `{"system":"TideStudio rules\n\nClient instructions"}`,
		},
		{
			name:       "responses with request instructions",
			path:       "/v1/responses",
			configured: "TideStudio rules",
			request:    `{"instructions":"Client instructions","input":"Hi"}`,
			want:       `{"instructions":"TideStudio rules\n\nClient instructions","input":"Hi"}`,
		},
		{
			name:       "responses without instructions",
			path:       "/v1/responses",
			configured: "TideStudio rules",
			request:    `{"input":"Hi"}`,
			want:       `{"instructions":"TideStudio rules","input":"Hi"}`,
		},
		{
			name:       "no TideStudio system prompt",
			path:       "/v1/messages",
			configured: "",
			request:    `{"system":"Client instructions"}`,
			want:       `{"system":"Client instructions"}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var payload, want map[string]any
			if err := json.Unmarshal([]byte(tc.request), &payload); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal([]byte(tc.want), &want); err != nil {
				t.Fatal(err)
			}
			applySystemPrompt(payload, tc.configured, tc.path)
			if !reflect.DeepEqual(payload, want) {
				t.Fatalf("combined system prompt mismatch:\n got: %#v\nwant: %#v", payload, want)
			}
		})
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
