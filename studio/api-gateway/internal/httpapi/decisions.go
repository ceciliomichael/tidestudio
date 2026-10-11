package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type decisionRequest struct {
	Model            string             `json:"model"`
	Input            any                `json:"input"`
	Questions        []decisionQuestion `json:"questions"`
	SafetyIdentifier *string            `json:"safety_identifier,omitempty"`
}

type decisionQuestion struct {
	Type         string           `json:"type"`
	Name         *string          `json:"name,omitempty"`
	Instructions string           `json:"instructions"`
	Choices      []decisionChoice `json:"choices,omitempty"`
	Levels       []decisionLevel  `json:"levels,omitempty"`
}

type decisionChoice struct {
	Value       any     `json:"value"`
	Description *string `json:"description,omitempty"`
}

type decisionLevel struct {
	Label       string  `json:"label"`
	Description *string `json:"description,omitempty"`
}

type choiceMapping struct {
	Key   string
	Value any
}

type translatedQuestion struct {
	Source  decisionQuestion
	Choices []choiceMapping
}

type systemOneResponse struct {
	Model   string                     `json:"model"`
	Answers map[string]json.RawMessage `json:"answers"`
	Usage   struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type systemOneAnswer struct {
	Type          string             `json:"type"`
	Noul          float64            `json:"noul"`
	Choice        string             `json:"choice"`
	Probabilities map[string]float64 `json:"probabilities"`
	Confidence    float64            `json:"confidence"`
	Score         float64            `json:"score"`
}

func (s *Server) decisions(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxInferenceRequestBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		apiError(w, http.StatusRequestEntityTooLarge, false, "request body too large")
		return
	}

	var request decisionRequest
	if err := json.Unmarshal(raw, &request); err != nil {
		apiError(w, http.StatusBadRequest, false, "invalid Decisions request")
		return
	}
	if request.Model == "" {
		apiError(w, http.StatusBadRequest, false, "missing model")
		return
	}
	if len(request.Questions) == 0 {
		apiError(w, http.StatusBadRequest, false, "questions must not be empty")
		return
	}

	worker, release, status, message := s.acquire(r.Context(), request.Model)
	if status != 0 {
		apiError(w, status, false, message)
		return
	}
	defer release()

	state, err := translateDecisionInput(request.Input)
	if err != nil {
		apiError(w, http.StatusBadRequest, false, err.Error())
		return
	}

	questions := make(map[string]any, len(request.Questions))
	translated := make([]translatedQuestion, len(request.Questions))
	for index, question := range request.Questions {
		key := fmt.Sprintf("q%d", index)
		translatedQuestion, body, err := translateDecisionQuestion(question)
		if err != nil {
			apiError(w, http.StatusBadRequest, false, fmt.Sprintf("question %d: %v", index, err))
			return
		}
		translated[index] = translatedQuestion
		questions[key] = body
	}

	upstreamBody := map[string]any{
		"model":     request.Model,
		"state":     state,
		"questions": questions,
	}
	encoded, err := json.Marshal(upstreamBody)
	if err != nil {
		apiError(w, http.StatusInternalServerError, false, "failed to prepare decision request")
		return
	}

	target, err := url.Parse(worker.BaseURL)
	if err != nil {
		apiError(w, http.StatusBadGateway, false, "invalid worker address")
		return
	}
	target.Path = "/v1/systemone"

	upstreamRequest, err := http.NewRequestWithContext(
		r.Context(),
		http.MethodPost,
		target.String(),
		bytes.NewReader(encoded),
	)
	if err != nil {
		apiError(w, http.StatusInternalServerError, false, "failed to prepare decision request")
		return
	}
	upstreamRequest.Header.Set("Content-Type", "application/json")

	transport := &http.Transport{
		Proxy:              nil,
		DialContext:        (&net.Dialer{Timeout: 3 * time.Second}).DialContext,
		DisableCompression: true,
	}
	defer transport.CloseIdleConnections()

	response, err := transport.RoundTrip(upstreamRequest)
	if err != nil {
		apiError(w, http.StatusBadGateway, false, "inference worker unavailable")
		return
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		apiError(w, http.StatusBadGateway, false, "failed to read decision worker response")
		return
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		w.Header().Set("Content-Type", response.Header.Get("Content-Type"))
		w.WriteHeader(response.StatusCode)
		_, _ = w.Write(responseBody)
		return
	}

	var systemOne systemOneResponse
	if err := json.Unmarshal(responseBody, &systemOne); err != nil {
		apiError(w, http.StatusBadGateway, false, "invalid System One response")
		return
	}

	answers := make([]any, 0, len(translated))
	for index, question := range translated {
		rawAnswer, ok := systemOne.Answers[fmt.Sprintf("q%d", index)]
		if !ok {
			apiError(w, http.StatusBadGateway, false, "System One response is missing an answer")
			return
		}

		var answer systemOneAnswer
		if err := json.Unmarshal(rawAnswer, &answer); err != nil {
			apiError(w, http.StatusBadGateway, false, "invalid System One answer")
			return
		}

		converted, err := translateSystemOneAnswer(question, answer)
		if err != nil {
			apiError(w, http.StatusBadGateway, false, err.Error())
			return
		}
		answers = append(answers, converted)
	}

	model := systemOne.Model
	if model == "" {
		model = request.Model
	}
	sendJSON(w, http.StatusOK, map[string]any{
		"model":   model,
		"answers": answers,
		"usage": map[string]any{
			"input_tokens": systemOne.Usage.InputTokens,
			"input_tokens_details": map[string]int{
				"cached_tokens":      0,
				"cache_write_tokens": 0,
			},
			"output_tokens": systemOne.Usage.OutputTokens,
			"output_tokens_details": map[string]int{
				"reasoning_tokens": 0,
			},
			"total_tokens": systemOne.Usage.InputTokens + systemOne.Usage.OutputTokens,
		},
	})
}

func translateDecisionInput(input any) (any, error) {
	switch value := input.(type) {
	case string:
		return value, nil
	case []any:
		messages := make([]any, 0, len(value))
		for _, rawMessage := range value {
			message, ok := rawMessage.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("input messages must be objects")
			}
			if role, _ := message["role"].(string); role != "user" {
				return nil, fmt.Errorf("Decisions input only supports user messages")
			}

			content, err := translateDecisionContent(message["content"])
			if err != nil {
				return nil, err
			}
			messages = append(messages, map[string]any{
				"role":    "user",
				"content": content,
			})
		}
		return messages, nil
	default:
		return nil, fmt.Errorf("input must be text or an array of user messages")
	}
}

func translateDecisionContent(content any) (any, error) {
	if text, ok := content.(string); ok {
		return text, nil
	}

	parts, ok := content.([]any)
	if !ok {
		return nil, fmt.Errorf("message content must be text or input parts")
	}

	converted := make([]any, 0, len(parts))
	for _, rawPart := range parts {
		part, ok := rawPart.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("input parts must be objects")
		}
		partType, _ := part["type"].(string)
		switch partType {
		case "input_text":
			text, ok := part["text"].(string)
			if !ok {
				return nil, fmt.Errorf("input_text part is missing text")
			}
			converted = append(converted, map[string]any{
				"type": "text",
				"text": text,
			})
		case "input_image":
			imageURL, ok := part["image_url"].(string)
			if !ok || imageURL == "" {
				return nil, fmt.Errorf("input_image part is missing image_url")
			}
			if !strings.HasPrefix(imageURL, "data:image/") {
				return nil, fmt.Errorf("local Decisions compatibility currently requires image data URLs")
			}
			image := map[string]any{
				"type": "image_url",
				"image_url": map[string]any{
					"url": imageURL,
				},
			}
			if detail, ok := part["detail"].(string); ok && detail != "" {
				image["image_url"].(map[string]any)["detail"] = detail
			}
			converted = append(converted, image)
		default:
			return nil, fmt.Errorf("unsupported Decisions input part type %q", partType)
		}
	}
	return converted, nil
}

func translateDecisionQuestion(question decisionQuestion) (translatedQuestion, map[string]any, error) {
	translated := translatedQuestion{Source: question}
	body := map[string]any{
		"instructions": question.Instructions,
	}

	switch question.Type {
	case "predicate":
		body["type"] = "noul"
	case "choice":
		if len(question.Choices) < 2 || len(question.Choices) > 255 {
			return translated, nil, fmt.Errorf("choice questions require between 2 and 255 choices")
		}

		mappings, criteria, err := translateDecisionChoices(question.Choices)
		if err != nil {
			return translated, nil, err
		}
		translated.Choices = mappings
		body["type"] = "choice"
		body["criteria"] = criteria
	case "score":
		if len(question.Levels) < 2 {
			return translated, nil, fmt.Errorf("score questions require at least 2 levels")
		}
		criteria := make([]string, len(question.Levels))
		for index, level := range question.Levels {
			if level.Label == "" {
				return translated, nil, fmt.Errorf("score levels require labels")
			}
			criteria[index] = level.Label
			if level.Description != nil && *level.Description != "" {
				criteria[index] += ": " + *level.Description
			}
		}
		body["type"] = "score"
		body["criteria"] = criteria
	default:
		return translated, nil, fmt.Errorf("unsupported question type %q", question.Type)
	}

	return translated, body, nil
}

func translateDecisionChoices(choices []decisionChoice) ([]choiceMapping, map[string]any, error) {
	keys := make([]string, len(choices))
	counts := map[string]int{}
	for index, choice := range choices {
		switch value := choice.Value.(type) {
		case string:
			if value == "" {
				return nil, nil, fmt.Errorf("choice values must not be empty")
			}
			keys[index] = value
		case bool:
			keys[index] = fmt.Sprintf("%t", value)
		default:
			return nil, nil, fmt.Errorf("choice values must be strings or booleans")
		}
		counts[keys[index]]++
	}

	mappings := make([]choiceMapping, len(choices))
	criteria := make(map[string]any, len(choices))
	for index, choice := range choices {
		key := keys[index]
		generated := counts[key] > 1
		if generated {
			key = fmt.Sprintf("__choice_%d", index)
		}

		var description any
		if choice.Description != nil && *choice.Description != "" {
			description = *choice.Description
		}
		if generated {
			label, _ := json.Marshal(choice.Value)
			prefix := "Value: " + string(label)
			if description != nil {
				description = prefix + ". " + description.(string)
			} else {
				description = prefix
			}
		}

		mappings[index] = choiceMapping{Key: key, Value: choice.Value}
		criteria[key] = description
	}
	return mappings, criteria, nil
}

func translateSystemOneAnswer(question translatedQuestion, answer systemOneAnswer) (map[string]any, error) {
	name := any(nil)
	if question.Source.Name != nil {
		name = *question.Source.Name
	}

	switch question.Source.Type {
	case "predicate":
		if answer.Type != "noul" {
			return nil, fmt.Errorf("System One returned %q for predicate question", answer.Type)
		}
		return map[string]any{
			"type":        "predicate",
			"name":        name,
			"probability": answer.Noul,
		}, nil
	case "choice":
		if answer.Type != "choice" {
			return nil, fmt.Errorf("System One returned %q for choice question", answer.Type)
		}

		var selected any
		probabilities := make([]any, 0, len(question.Choices))
		for _, mapping := range question.Choices {
			if mapping.Key == answer.Choice {
				selected = mapping.Value
			}
			probabilities = append(probabilities, map[string]any{
				"value":       mapping.Value,
				"probability": answer.Probabilities[mapping.Key],
			})
		}
		if selected == nil {
			return nil, fmt.Errorf("System One returned an unknown choice")
		}
		return map[string]any{
			"type":          "choice",
			"name":          name,
			"choice":        selected,
			"probabilities": probabilities,
			"confidence":    answer.Confidence,
		}, nil
	case "score":
		if answer.Type != "score" {
			return nil, fmt.Errorf("System One returned %q for score question", answer.Type)
		}
		probabilities := make([]any, 0, len(question.Source.Levels))
		for index, level := range question.Source.Levels {
			probabilities = append(probabilities, map[string]any{
				"value":       index,
				"label":       level.Label,
				"probability": answer.Probabilities[fmt.Sprintf("%d", index)],
			})
		}
		return map[string]any{
			"type":          "score",
			"name":          name,
			"score":         answer.Score,
			"probabilities": probabilities,
			"confidence":    answer.Confidence,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported question type %q", question.Source.Type)
	}
}
