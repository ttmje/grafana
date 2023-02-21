package anonimpl

import (
	"context"
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/web"
)

const thirtyDays = 30 * 24 * time.Hour
const anonCachePrefix = "anon-session"

type AnonSession struct {
	ip        string
	userAgent string
}

func (a *AnonSession) Key() (string, error) {
	key := strings.Builder{}
	key.WriteString(a.ip)
	key.WriteString(a.userAgent)

	hash := fnv.New128a()
	if _, err := hash.Write([]byte(key.String())); err != nil {
		return "", fmt.Errorf("failed to write to hash: %w", err)
	}

	return strings.Join([]string{anonCachePrefix, hex.EncodeToString(hash.Sum(nil))}, ":"), nil
}

type AnonSessionService struct {
	remoteCache remotecache.CacheStorage
	log         log.Logger
}

func ProvideAnonymousSessionService(remoteCache remotecache.CacheStorage, usageStats usagestats.Service) *AnonSessionService {
	a := &AnonSessionService{
		remoteCache: remoteCache,
		log:         log.New("anonymous-session-service"),
	}

	usageStats.RegisterMetricsFunc(a.UsageStatFn)

	return a
}

func (a *AnonSessionService) UsageStatFn(ctx context.Context) (map[string]interface{}, error) {
	sessionCount, err := a.remoteCache.Count(ctx, anonCachePrefix)
	if err != nil {
		return nil, nil
	}

	return map[string]interface{}{
		"stats.anonymous.session.count": sessionCount,
	}, nil
}

func (a *AnonSessionService) TagSession(ctx context.Context, httpReq *http.Request) error {
	addr := web.RemoteAddr(httpReq)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		a.log.Debug("failed to parse ip from address", "addr", addr)
		return nil
	}

	clientIPStr := ip.String()
	if len(ip) == 0 {
		clientIPStr = ""
	}

	anonSession := &AnonSession{
		ip:        clientIPStr,
		userAgent: httpReq.UserAgent(),
	}

	key, err := anonSession.Key()
	if err != nil {
		return err
	}

	return a.remoteCache.Set(ctx, key, key, thirtyDays)
}
