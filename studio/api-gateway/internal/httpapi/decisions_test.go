package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecisionsAdapterUsesSystemOneProbabilities(t *testing.T) {
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/systemone" {
			t.Fatalf("unexpected worker path: %s", r.URL.Path)
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["model"] != "decision-model" || body["state"] != "double charge" {
			t.Fatalf("unexpected translated body: %#v", body)
		}

		questions := body["questions"].(map[string]any)
		if questions["q0"].(map[string]any)["type"] != "noul" {
			t.Fatalf("predicate was not translated to noul: %#v", questions["q0"])
		}
		if questions["q1"].(map[string]any)["type"] != "choice" {
			t.Fatalf("choice was not translated: %#v", questions["q1"])
		}
		if questions["q2"].(map[string]any)["type"] != "score" {
			t.Fatalf("score was not translated: %#v", questions["q2"])
		}

		sendJSON(w, http.StatusOK, map[string]any{
			"model": "openjev-local",
			"answers": map[string]any{
				"q0": map[string]any{
					"type": "noul",
					"noul": 0.91,
				},
				"q1": map[string]any{
					"type":       "choice",
					"choice":     "billing",
					"confidence": 0.74,
					"probabilities": map[string]float64{
						"billing": 0.88,
						"support": 0.12,
					},
				},
				"q2": map[string]any{
					"type":       "score",
					"score":      1.2,
					"confidence": 0.52,
					"probabilities": map[string]float64{
						"0": 0.1,
						"1": 0.6,
						"2": 0.3,
					},
				},
			},
			"usage": map[string]int{
				"input_tokens":  42,
				"output_tokens": 0,
			},
		})
	}))
	defer worker.Close()

	gateway := New(Config{ControlToken: "private"}).(*Server)
	if err := gateway.registry.Register(Worker{
		ModelID: "decision-model",
		BaseURL: worker.URL,
	}); err != nil {
		t.Fatal(err)
	}

	body := `{
		"model":"decision-model",
		"input":"double charge",
		"questions":[
			{"type":"predicate","name":"duplicate","instructions":"Was the customer charged twice?"},
			{"type":"choice","name":"route","instructions":"Which team?","choices":[
				{"value":"billing","description":"Payment issues"},
				{"value":"support","description":"Product issues"}
			]},
			{"type":"score","name":"severity","instructions":"How severe?","levels":[
				{"label":"Low"},
				{"label":"Medium"},
				{"label":"High"}
			]}
		]
	}`
	request := httptest.NewRequest(http.MethodPost, "/v1/decisions", strings.NewReader(body))
	response := httptest.NewRecorder()
	gateway.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d %s", response.Code, response.Body.String())
	}

	var result struct {
		Model   string           `json:"model"`
		Answers []map[string]any `json:"answers"`
		Usage   map[string]any   `json:"usage"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Model != "openjev-local" || len(result.Answers) != 3 {
		t.Fatalf("unexpected decision response: %s", response.Body.String())
	}
	if result.Answers[0]["type"] != "predicate" || result.Answers[0]["probability"] != 0.91 {
		t.Fatalf("bad predicate answer: %#v", result.Answers[0])
	}
	if result.Answers[1]["choice"] != "billing" || result.Answers[1]["confidence"] != 0.74 {
		t.Fatalf("bad choice answer: %#v", result.Answers[1])
	}
	if result.Answers[2]["score"] != 1.2 || result.Answers[2]["confidence"] != 0.52 {
		t.Fatalf("bad score answer: %#v", result.Answers[2])
	}
	if result.Usage["input_tokens"] != float64(42) || result.Usage["total_tokens"] != float64(42) {
		t.Fatalf("bad usage: %#v", result.Usage)
	}
}

func TestSystemOnePassesThroughToWorker(t *testing.T) {
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/systemone" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"model":"decision-model","answers":{"q":{"type":"noul","noul":0.8}},"usage":{"input_tokens":5,"output_tokens":0}}`))
	}))
	defer worker.Close()

	gateway := New(Config{ControlToken: "private"}).(*Server)
	if err := gateway.registry.Register(Worker{
		ModelID: "decision-model",
		BaseURL: worker.URL,
	}); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/systemone",
		strings.NewReader(`{"model":"decision-model","state":"hello","questions":{"q":{"type":"noul","instructions":"Relevant?"}}}`),
	)
	response := httptest.NewRecorder()
	gateway.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"noul":0.8`) {
		t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
	}
}
