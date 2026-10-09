package httpapi

func isInferencePath(path string) bool {
	switch path {
	case "/v1/chat/completions",
		"/v1/responses",
		"/v1/messages",
		"/v1/messages/count_tokens",
		"/v1/completions",
		"/v1/embeddings",
		"/v1/systemone":
		return true
	}
	return false
}
