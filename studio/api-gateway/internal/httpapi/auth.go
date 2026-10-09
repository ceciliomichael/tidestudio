package httpapi

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

func equalSecret(provided, expected string) bool {
	if len(provided) != len(expected) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func (s *Server) authorized(r *http.Request) bool {
	if s.cfg.APIKey == "" {
		return true
	}

	bearer := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	return equalSecret(bearer, s.cfg.APIKey) ||
		equalSecret(r.Header.Get("x-api-key"), s.cfg.APIKey)
}

func apiError(w http.ResponseWriter, status int, anthropic bool, message string) {
	if anthropic {
		kind := "invalid_request_error"
		if status == http.StatusNotFound {
			kind = "not_found_error"
		}
		if status == http.StatusUnauthorized {
			kind = "authentication_error"
		}
		sendJSON(w, status, map[string]any{
			"type": "error",
			"error": map[string]any{
				"type":    kind,
				"message": message,
			},
		})
		return
	}

	sendJSON(w, status, map[string]any{
		"error": map[string]any{
			"message": message,
			"type":    "invalid_request_error",
		},
	})
}
