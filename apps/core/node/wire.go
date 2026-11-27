package node

import (
	"strings"
	"time"
)

type SpacesResponse struct {
	Node   string      `json:"node"`
	Spaces []SpaceInfo `json:"spaces"`
}

type SpaceInfo struct {
	Name       string `json:"name"`
	Status     string `json:"status"`
	Supervised bool   `json:"supervised"`
}

type StateResponse struct {
	Space    string         `json:"space"`
	AllReady bool           `json:"all_ready"`
	Services []ServiceState `json:"services"`
}

type ServiceState struct {
	Name           string          `json:"name"`
	State          string          `json:"state"`
	Image          string          `json:"image"`
	Oneshot        bool            `json:"oneshot"`
	Instances      []InstanceState `json:"instances"`
	Rollouts       []RolloutState  `json:"rollouts"`
	RejectedReason string          `json:"rejected_reason"`
}

type InstanceState struct {
	ID        string     `json:"id"`
	State     string     `json:"state"`
	Restarts  int        `json:"restarts"`
	StartedAt *time.Time `json:"started_at"`
	Held      bool       `json:"held"`
}

type RolloutState struct {
	FromImage  string    `json:"from_image"`
	ToImage    string    `json:"to_image"`
	Result     string    `json:"result"`
	Reason     string    `json:"reason"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
}

type ManifestResponse struct {
	Space    string            `json:"space"`
	Stack    string            `json:"stack"`
	URL      string            `json:"url"`
	Routes   []ManifestRoute   `json:"routes"`
	Services []ManifestService `json:"services"`
}

type ManifestRoute struct {
	Service string `json:"service"`
	Host    string `json:"host"`
	Path    string `json:"path"`
}

type ManifestService struct {
	Name  string `json:"name"`
	Image string `json:"image"`
	Port  int    `json:"port"`
}

type FollowsResponse struct {
	Node    string   `json:"node"`
	Follows []Follow `json:"follows"`
}

type Follow struct {
	Name    string    `json:"name"`
	Repo    string    `json:"repo"`
	Branch  string    `json:"branch"`
	AddedAt time.Time `json:"added_at"`
	Pinned  bool      `json:"pinned"`
}

// pin marks the node's own showcase repos: followed from a path on the node,
// which only its operator can add (a visitor may only follow an https URL).
// They stay through every visitor action.
func pin(follows []Follow) []Follow {
	for i := range follows {
		follows[i].Pinned = !strings.HasPrefix(follows[i].Repo, "https://")
	}
	return follows
}

type FollowRequest struct {
	Repo   string `json:"repo"`
	Branch string `json:"branch,omitempty"`
	Name   string `json:"name,omitempty"`
}

type WatchesResponse struct {
	Node    string  `json:"node"`
	Watches []Watch `json:"watches"`
}

type Watch struct {
	Name          string     `json:"name"`
	Repo          string     `json:"repo"`
	Space         string     `json:"space"`
	Service       string     `json:"service"`
	Image         string     `json:"image"`
	TagPattern    string     `json:"tag_pattern"`
	CurrentTag    string     `json:"current_tag"`
	Status        string     `json:"status"`
	HeldTag       string     `json:"held_tag"`
	LastError     string     `json:"last_error"`
	LastCheckedAt *time.Time `json:"last_checked_at"`
	LastRolledAt  *time.Time `json:"last_rolled_at"`
	Rolls         []Roll     `json:"rolls"`
}

type Roll struct {
	FromTag    string     `json:"from_tag"`
	ToTag      string     `json:"to_tag"`
	Result     string     `json:"result"`
	Error      string     `json:"error"`
	CreatedAt  time.Time  `json:"created_at"`
	FinishedAt *time.Time `json:"finished_at"`
}
