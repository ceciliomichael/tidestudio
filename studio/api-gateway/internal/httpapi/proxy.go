package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

const maxInferenceRequestBytes = 32 << 20

func (s *Server) proxy(w http.ResponseWriter, r *http.Request, anthropic bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxInferenceRequestBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		apiError(w, http.StatusRequestEntityTooLarge, anthropic, "request body too large")
		return
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		apiError(w, http.StatusBadRequest, anthropic, "invalid JSON or missing model")
		return
	}
	model, _ := payload["model"].(string)
	if model == "" {
		apiError(w, http.StatusBadRequest, anthropic, "invalid JSON or missing model")
		return
	}

	worker, ok := s.registry.Resolve(model)
	if !ok {
		apiError(w, http.StatusNotFound, anthropic, "model is not loaded")
		return
	}

	applyInferenceDefaults(payload, worker.Defaults, r.URL.Path)
	raw, err = json.Marshal(payload)
	if err != nil {
		apiError(w, http.StatusInternalServerError, anthropic, "failed to prepare inference request")
		return
	}

	target, err := url.Parse(worker.BaseURL)
	if err != nil {
		apiError(w, http.StatusBadGateway, anthropic, "invalid worker address")
		return
	}

	r.Body = io.NopCloser(bytes.NewReader(raw))
	r.ContentLength = int64(len(raw))

	proxy := httputil.NewSingleHostReverseProxy(target)
	transport := &http.Transport{
		Proxy:              nil,
		DialContext:        (&net.Dialer{Timeout: 3 * time.Second}).DialContext,
		DisableCompression: true,
	}
	defer transport.CloseIdleConnections()

	proxy.Transport = transport
	proxy.FlushInterval = -1
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		apiError(w, http.StatusBadGateway, anthropic, "inference worker unavailable")
	}

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		req.Header.Del("Authorization")
		req.Header.Del("x-api-key")
		req.Header.Del("Cookie")
	}

	proxy.ServeHTTP(w, r)
}

func applyInferenceDefaults(payload map[string]any, defaults InferenceDefaults, path string) {
	if path == "/v1/embeddings" || path == "/v1/systemone" {
		return
	}

	applySystemPrompt(payload, defaults.SystemPrompt, path)
	if path == "/v1/messages/count_tokens" {
		return
	}
	applySamplingDefaults(payload, defaults, path)
	applyThinkingDefaults(payload, defaults, path)
}

func applySystemPrompt(payload map[string]any, systemPrompt, path string) {
	if systemPrompt == "" {
		return
	}

	switch path {
	case "/v1/chat/completions":
		messages, ok := payload["messages"].([]any)
		if !ok {
			return
		}
		for _, item := range messages {
			message, ok := item.(map[string]any)
			if ok && message["role"] == "system" {
				return
			}
		}
		payload["messages"] = append(
			[]any{map[string]any{"role": "system", "content": systemPrompt}},
			messages...,
		)
	case "/v1/messages":
		setIfMissing(payload, "system", systemPrompt)
	case "/v1/messages/count_tokens":
		setIfMissing(payload, "system", systemPrompt)
	case "/v1/responses":
		setIfMissing(payload, "instructions", systemPrompt)
	}
}

func applySamplingDefaults(payload map[string]any, defaults InferenceDefaults, path string) {
	setOptional(payload, "temperature", defaults.Temperature)
	setOptional(payload, "top_p", defaults.TopP)

	if path == "/v1/messages" {
		setOptional(payload, "top_k", defaults.TopK)
		return
	}

	setOptional(payload, "top_k", defaults.TopK)
	setOptional(payload, "min_p", defaults.MinP)
	setOptional(payload, "typical_p", defaults.TypicalP)
	setOptional(payload, "seed", defaults.Seed)
	setOptional(payload, "repeat_penalty", defaults.RepeatPenalty)
	setOptional(payload, "presence_penalty", defaults.PresencePenalty)
	setOptional(payload, "frequency_penalty", defaults.FrequencyPenalty)
}

func applyThinkingDefaults(payload map[string]any, defaults InferenceDefaults, path string) {
	switch path {
	case "/v1/chat/completions":
		if defaults.ThinkingEnabled != nil || defaults.ReasoningPreserve != nil {
			kwargs, _ := payload["chat_template_kwargs"].(map[string]any)
			if kwargs == nil {
				kwargs = map[string]any{}
				payload["chat_template_kwargs"] = kwargs
			}
			if defaults.ThinkingEnabled != nil {
				setIfMissing(kwargs, "enable_thinking", *defaults.ThinkingEnabled)
			}
			if defaults.ReasoningPreserve != nil {
				setIfMissing(kwargs, "preserve_reasoning", *defaults.ReasoningPreserve)
			}
		}
		if defaults.ReasoningEffort != "" && defaults.ReasoningEffort != "default" {
			setIfMissing(payload, "reasoning_effort", defaults.ReasoningEffort)
		}
		setOptional(payload, "thinking_budget_tokens", defaults.ReasoningBudget)
	case "/v1/responses":
		if defaults.ThinkingEnabled != nil || defaults.ReasoningPreserve != nil {
			kwargs, _ := payload["chat_template_kwargs"].(map[string]any)
			if kwargs == nil {
				kwargs = map[string]any{}
				payload["chat_template_kwargs"] = kwargs
			}
			if defaults.ThinkingEnabled != nil {
				setIfMissing(kwargs, "enable_thinking", *defaults.ThinkingEnabled)
			}
			if defaults.ReasoningPreserve != nil {
				setIfMissing(kwargs, "preserve_reasoning", *defaults.ReasoningPreserve)
			}
		}
		if defaults.ReasoningEffort != "" &&
			defaults.ReasoningEffort != "default" &&
			payload["reasoning"] == nil {
			payload["reasoning"] = map[string]any{"effort": defaults.ReasoningEffort}
		}
		setOptional(payload, "thinking_budget_tokens", defaults.ReasoningBudget)
	case "/v1/messages":
		if defaults.ThinkingEnabled == nil {
			return
		}
		if _, exists := payload["thinking"]; exists {
			return
		}
		if !*defaults.ThinkingEnabled {
			payload["thinking"] = map[string]any{"type": "disabled"}
			return
		}
		budget := 1024
		if defaults.ReasoningBudget != nil && *defaults.ReasoningBudget > 0 {
			budget = *defaults.ReasoningBudget
		}
		payload["thinking"] = map[string]any{
			"type":          "enabled",
			"budget_tokens": budget,
		}
	}
}

func setIfMissing(payload map[string]any, key string, value any) {
	if _, exists := payload[key]; !exists {
		payload[key] = value
	}
}

func setOptional[T any](payload map[string]any, key string, value *T) {
	if value != nil {
		setIfMissing(payload, key, *value)
	}
}
