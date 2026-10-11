package httpapi

import (
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strings"
)

func isLoopback(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func validWorkerURL(raw string) bool {
	address, err := url.Parse(raw)
	if err != nil ||
		address.Scheme != "http" ||
		address.User != nil ||
		address.RawQuery != "" ||
		address.Path != "" ||
		address.Fragment != "" {
		return false
	}

	ip := net.ParseIP(address.Hostname())
	return ip != nil && ip.IsLoopback() && address.Port() != ""
}

func (s *Server) control(w http.ResponseWriter, r *http.Request) {
	if !isLoopback(r) ||
		!equalSecret(r.Header.Get("X-TideStudio-Control-Token"), s.cfg.ControlToken) {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodGet && r.URL.Path == "/_tidestudio/workers" {
		sendJSON(w, http.StatusOK, s.registry.List())
		return
	}
	if r.URL.Path == "/_tidestudio/jit/models" && r.Method == http.MethodPut {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var ids []string
		if json.NewDecoder(r.Body).Decode(&ids) != nil {
			http.Error(w, "invalid model catalog", http.StatusBadRequest)
			return
		}
		s.jit.setInstalled(ids)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/_tidestudio/jit/actions" && r.Method == http.MethodGet {
		if action, ok := s.jit.nextAction(s.cfg, s.registry.List()); ok {
			sendJSON(w, http.StatusOK, action)
		} else {
			w.WriteHeader(http.StatusNoContent)
		}
		return
	}
	if r.URL.Path == "/_tidestudio/jit/fail" && r.Method == http.MethodPost {
		var failure struct {
			ModelID string `json:"model_id"`
			Error   string `json:"error"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
		if json.NewDecoder(r.Body).Decode(&failure) != nil || failure.ModelID == "" {
			http.Error(w, "invalid JIT failure", http.StatusBadRequest)
			return
		}
		s.jit.failed(failure.ModelID, failure.Error)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	const prefix = "/_tidestudio/workers/"
	if !strings.HasPrefix(r.URL.Path, prefix) {
		http.NotFound(w, r)
		return
	}

	id, err := url.PathUnescape(strings.TrimPrefix(r.URL.EscapedPath(), prefix))
	if err != nil || id == "" || strings.Contains(id, "?") {
		http.Error(w, "invalid model ID", http.StatusBadRequest)
		return
	}

	if r.Method == http.MethodDelete {
		s.registry.Unregister(id)
		s.jit.unregistered(id)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	var worker Worker
	if err := json.NewDecoder(r.Body).Decode(&worker); err != nil ||
		worker.ModelID != id || !validWorkerURL(worker.BaseURL) {
		http.Error(w, "invalid worker registration", http.StatusBadRequest)
		return
	}

	if err := s.registry.Register(worker); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	s.jit.registered(id)
	w.WriteHeader(http.StatusNoContent)
}
