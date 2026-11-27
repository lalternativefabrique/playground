package node

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"
)

type Overview struct {
	Node    string      `json:"node"`
	Verdict Verdict     `json:"verdict"`
	Spaces  []SpaceView `json:"spaces"`
	Follows []Follow    `json:"follows"`
}

type SpaceView struct {
	Name     string        `json:"name"`
	Repo     *Follow       `json:"repo,omitempty"`
	URL      string        `json:"url,omitempty"`
	Health   SpaceHealth   `json:"health"`
	Rolling  bool          `json:"rolling"`
	Images   []string      `json:"images"`
	Error    string        `json:"error,omitempty"`
	Services []ServiceView `json:"services,omitempty"`
	Watches  []Watch       `json:"watches,omitempty"`
}

type ServiceView struct {
	Name     string         `json:"name"`
	State    string         `json:"state"`
	Health   Health         `json:"health"`
	Image    string         `json:"image"`
	Oneshot  bool           `json:"oneshot"`
	Port     int            `json:"port,omitempty"`
	Routes   []string       `json:"routes"`
	Replicas int            `json:"replicas"`
	Restarts int            `json:"restarts"`
	Since    *time.Time     `json:"since,omitempty"`
	Rollouts []RolloutState `json:"rollouts"`
	Rejected string         `json:"rejected,omitempty"`
}

type Service struct {
	client *Client
	now    func() time.Time
}

func NewService(client *Client) *Service {
	return &Service{client: client, now: time.Now}
}

type spaceReads struct {
	state    StateResponse
	manifest ManifestResponse
	err      error
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	spaces, err := s.client.Spaces(ctx)
	if err != nil {
		return Overview{}, err
	}
	var follows FollowsResponse
	var watches WatchesResponse
	var followErr, watchErr error
	reads := make([]spaceReads, len(spaces.Spaces))
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); follows, followErr = s.client.Follows(ctx) }()
	go func() { defer wg.Done(); watches, watchErr = s.client.Watches(ctx) }()
	for i, sp := range spaces.Spaces {
		if !sp.Supervised {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			reads[i] = s.readSpace(ctx, sp.Name)
		}()
	}
	wg.Wait()
	if followErr != nil {
		return Overview{}, followErr
	}
	if watchErr != nil {
		return Overview{}, watchErr
	}

	out := Overview{Node: spaces.Node, Spaces: []SpaceView{}, Follows: nonNil(follows.Follows)}
	var verdicts []Verdict
	for i, sp := range spaces.Spaces {
		if !sp.Supervised {
			continue
		}
		if isEmpty(reads[i]) {
			continue
		}
		view := s.view(sp, reads[i], follows.Follows, watches.Watches)
		verdicts = append(verdicts, view.Health.Verdict)
		view.Services, view.Watches = nil, nil
		out.Spaces = append(out.Spaces, view)
	}
	sort.SliceStable(out.Spaces, func(i, j int) bool {
		a, b := out.Spaces[i].Health.Verdict, out.Spaces[j].Health.Verdict
		if verdictRank[a] != verdictRank[b] {
			return verdictRank[a] < verdictRank[b]
		}
		return out.Spaces[i].Name < out.Spaces[j].Name
	})
	out.Verdict = Worst(verdicts)
	return out, nil
}

func (s *Service) Space(ctx context.Context, name string) (SpaceView, error) {
	spaces, err := s.client.Spaces(ctx)
	if err != nil {
		return SpaceView{}, err
	}
	for _, sp := range spaces.Spaces {
		if sp.Name != name || !sp.Supervised {
			continue
		}
		follows, err := s.client.Follows(ctx)
		if err != nil {
			return SpaceView{}, err
		}
		watches, err := s.client.Watches(ctx)
		if err != nil {
			return SpaceView{}, err
		}
		return s.view(sp, s.readSpace(ctx, name), follows.Follows, watches.Watches), nil
	}
	return SpaceView{}, ErrNotFound
}

// isEmpty is a supervised space that declares and runs nothing, such as the
// one holding the node's own credentials: not an app.
func isEmpty(r spaceReads) bool {
	return r.err == nil && len(r.state.Services) == 0 && len(r.manifest.Services) == 0
}

func (s *Service) readSpace(ctx context.Context, space string) spaceReads {
	var r spaceReads
	var manifestErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); r.state, r.err = s.client.State(ctx, space) }()
	go func() { defer wg.Done(); r.manifest, manifestErr = s.client.Manifest(ctx, space) }()
	wg.Wait()
	if r.err == nil && manifestErr != nil && manifestErr != ErrNotFound {
		r.err = manifestErr
	}
	return r
}

func (s *Service) view(sp SpaceInfo, r spaceReads, follows []Follow, watches []Watch) SpaceView {
	v := SpaceView{Name: sp.Name, Images: []string{}, Services: []ServiceView{}, Watches: []Watch{}}
	if r.err != nil {
		v.Error = "the node did not answer for this space"
		v.Health = SpaceHealth{Verdict: VerdictUnknown, Culprits: []Culprit{}, Label: "unreadable"}
		return v
	}
	v.Repo = ownerFollow(r.manifest.Stack, follows)
	v.URL = publicURL(r.manifest)
	v.Health = Assess(r.state.Services, sp.Status, s.now())

	routes := map[string][]string{}
	for _, rt := range r.manifest.Routes {
		if rt.Host != "" {
			routes[rt.Service] = append(routes[rt.Service], rt.Host+rt.Path)
		}
	}
	ports := map[string]int{}
	for _, ms := range r.manifest.Services {
		ports[ms.Name] = ms.Port
	}
	for _, st := range r.state.Services {
		if st.Image != "" {
			v.Images = append(v.Images, st.Image)
		}
		if inFlight(st.Rollouts) {
			v.Rolling = true
		}
		v.Services = append(v.Services, serviceView(st, ports[st.Name], routes[st.Name]))
	}
	for _, w := range watches {
		if w.Space != sp.Name {
			continue
		}
		if w.Status == "rolling" {
			v.Rolling = true
		}
		w.Rolls = nonNil(w.Rolls)
		v.Watches = append(v.Watches, w)
	}
	return v
}

func serviceView(st ServiceState, port int, routes []string) ServiceView {
	sv := ServiceView{
		Name: st.Name, State: st.State, Health: ServiceHealth(st.State), Image: st.Image,
		Oneshot: st.Oneshot, Port: port, Routes: nonNil(routes), Replicas: len(st.Instances),
		Rollouts: nonNil(st.Rollouts), Rejected: st.RejectedReason,
	}
	for _, in := range st.Instances {
		sv.Restarts = max(sv.Restarts, in.Restarts)
		if in.StartedAt != nil && (sv.Since == nil || in.StartedAt.Before(*sv.Since)) {
			sv.Since = in.StartedAt
		}
	}
	return sv
}

func inFlight(rollouts []RolloutState) bool {
	return len(rollouts) > 0 && rollouts[len(rollouts)-1].FinishedAt.IsZero()
}

// ownerFollow maps a space to the followed repo that applied it: a node
// reconciling from repos records the space's stack as "<repo>/<stack>".
func ownerFollow(stack string, follows []Follow) *Follow {
	repo, _, ok := strings.Cut(stack, "/")
	if !ok {
		return nil
	}
	for _, f := range follows {
		if f.Name == repo {
			return &f
		}
	}
	return nil
}

func publicURL(m ManifestResponse) string {
	if m.URL != "" {
		return m.URL
	}
	for _, rt := range m.Routes {
		if rt.Host != "" {
			return "http://" + rt.Host + rt.Path
		}
	}
	return ""
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
