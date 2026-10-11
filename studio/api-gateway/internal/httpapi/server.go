package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Server struct {
	cfg      Config
	registry *Registry
	jit      *JITManager
}

func New(cfg Config) http.Handler {
	return &Server{
		cfg:      cfg,
		registry: NewRegistry(),
		jit:      newJITManager(),
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/_tidestudio/") {
		s.control(w, r)
		return
	}

	if s.cfg.CORS {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers",
			"Authorization, Content-Type, x-api-key, anthropic-version, anthropic-beta, OpenAI-Beta")
	}
	if r.Method == http.MethodOptions && s.cfg.CORS {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	anthropic := strings.HasPrefix(r.URL.Path, "/v1/messages")
	if !s.authorized(r) {
		apiError(w, http.StatusUnauthorized, anthropic, "invalid API key")
		return
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/health":
		sendJSON(w, http.StatusOK, map[string]string{"status": "ok"})

	case r.Method == http.MethodGet && r.URL.Path == "/v1/models":
		workers := s.registry.List()
		data := make([]any, 0, len(workers))
		seen := make(map[string]bool)
		for _, worker := range workers {
			seen[worker.ModelID] = true
			data = append(data, map[string]any{
				"id":       worker.ModelID,
				"object":   "model",
				"owned_by": "tidestudio",
			})
		}
		if s.cfg.JITModelLoading {
			s.jit.mu.Lock()
			for id := range s.jit.installed {
				if !seen[id] {
					data = append(data, map[string]any{"id": id, "object": "model", "owned_by": "tidestudio"})
				}
			}
			s.jit.mu.Unlock()
		}
		sendJSON(w, http.StatusOK, map[string]any{"object": "list", "data": data})

	case r.Method == http.MethodPost && r.URL.Path == "/v1/decisions":
		s.decisions(w, r)

	case r.Method == http.MethodPost && isInferencePath(r.URL.Path):
		s.proxy(w, r, anthropic)

	default:
		apiError(w, http.StatusNotFound, anthropic, "route not found")
	}
}

func sendJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
