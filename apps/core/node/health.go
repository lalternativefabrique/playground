package node

import (
	"fmt"
	"time"
)

type Verdict string

const (
	VerdictHealthy  Verdict = "healthy"
	VerdictUnstable Verdict = "unstable"
	VerdictDegraded Verdict = "degraded"
	VerdictDown     Verdict = "down"
	VerdictStarting Verdict = "starting"
	VerdictStopped  Verdict = "stopped"
	VerdictUnknown  Verdict = "unknown"
)

type Health string

const (
	HealthHealthy Health = "healthy"
	HealthPending Health = "pending"
	HealthFailed  Health = "failed"
	HealthNeutral Health = "neutral"
)

// A crash loop reads "ready" by the time anything polls it: enough recent
// restarts is what tells it from a service that stayed up.
const (
	flapMinRestarts = 3
	flapWindow      = 10 * time.Minute
)

func ServiceHealth(state string) Health {
	switch state {
	case "ready", "done":
		return HealthHealthy
	case "failed", "degraded":
		return HealthFailed
	case "pending", "starting", "restarting", "running":
		return HealthPending
	default:
		return HealthNeutral
	}
}

type Culprit struct {
	Name  string `json:"name"`
	State string `json:"state"`
}

type SpaceHealth struct {
	Verdict  Verdict   `json:"verdict"`
	Up       int       `json:"up"`
	Total    int       `json:"total"`
	Culprits []Culprit `json:"culprits"`
	Label    string    `json:"label"`
}

func isUp(s ServiceState) bool {
	return s.State == "ready" || (s.Oneshot && s.State == "done")
}

func isBroken(s ServiceState) bool {
	return s.State == "failed" || s.State == "restarting" || s.State == "degraded"
}

func isStuck(s ServiceState) bool {
	if s.RejectedReason != "" {
		return true
	}
	for _, i := range s.Instances {
		if i.Held {
			return true
		}
	}
	return false
}

func maxRestarts(s ServiceState) int {
	n := 0
	for _, i := range s.Instances {
		n = max(n, i.Restarts)
	}
	return n
}

func isFlapping(s ServiceState, now time.Time) bool {
	for _, i := range s.Instances {
		if i.Restarts < flapMinRestarts {
			continue
		}
		if i.StartedAt == nil || !i.StartedAt.Before(now) || now.Sub(*i.StartedAt) <= flapWindow {
			return true
		}
	}
	return false
}

func more(n int) string {
	if n > 1 {
		return fmt.Sprintf(" +%d", n-1)
	}
	return ""
}

func Assess(services []ServiceState, spaceStatus string, now time.Time) SpaceHealth {
	total := len(services)
	h := SpaceHealth{Total: total, Culprits: []Culprit{}}
	for _, s := range services {
		if isUp(s) {
			h.Up++
		}
		if isBroken(s) {
			h.Culprits = append(h.Culprits, Culprit{s.Name, s.State})
		}
	}
	switch {
	case spaceStatus == "stopped":
		return SpaceHealth{Verdict: VerdictStopped, Total: total, Culprits: []Culprit{}, Label: "stopped"}
	case total == 0:
		h.Verdict, h.Label = VerdictUnknown, "no service reported"
		return h
	case len(h.Culprits) > 0:
		h.Verdict = VerdictDegraded
		if h.Up == 0 {
			h.Verdict = VerdictDown
		}
		first := h.Culprits[0]
		h.Label = fmt.Sprintf("%d/%d up · %s %s%s", h.Up, total, first.Name, first.State, more(len(h.Culprits)))
		return h
	}
	for _, s := range services {
		if isStuck(s) {
			h.Verdict, h.Culprits = VerdictUnstable, []Culprit{{s.Name, s.State}}
			h.Label = fmt.Sprintf("%d/%d up · %s stuck", h.Up, total, s.Name)
			return h
		}
	}
	var flapping []ServiceState
	for _, s := range services {
		if isFlapping(s, now) {
			flapping = append(flapping, s)
			h.Culprits = append(h.Culprits, Culprit{s.Name, s.State})
		}
	}
	if len(flapping) > 0 {
		h.Verdict = VerdictUnstable
		h.Label = fmt.Sprintf("%d/%d up · %s restarted %d×%s", h.Up, total, flapping[0].Name, maxRestarts(flapping[0]), more(len(flapping)))
		return h
	}
	if h.Up == total {
		noun := "services"
		if total == 1 {
			noun = "service"
		}
		h.Verdict, h.Label = VerdictHealthy, fmt.Sprintf("%d %s, all up", total, noun)
		return h
	}
	h.Verdict, h.Label = VerdictStarting, fmt.Sprintf("%d/%d up · starting", h.Up, total)
	return h
}

var verdictRank = map[Verdict]int{
	VerdictDown: 0, VerdictDegraded: 1, VerdictUnstable: 2, VerdictStarting: 3,
	VerdictUnknown: 4, VerdictStopped: 5, VerdictHealthy: 6,
}

func Worst(verdicts []Verdict) Verdict {
	worst := VerdictUnknown
	for i, v := range verdicts {
		if i == 0 || verdictRank[v] < verdictRank[worst] {
			worst = v
		}
	}
	return worst
}
