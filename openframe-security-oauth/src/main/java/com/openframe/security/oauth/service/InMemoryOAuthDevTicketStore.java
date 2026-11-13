package com.openframe.security.oauth.service;

import com.openframe.security.oauth.dto.TokenResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Single-use dev tickets that expire after the TTL; expired ones are evicted on every new ticket. */
@Component
@ConditionalOnMissingBean(value = OAuthDevTicketStore.class, ignored = InMemoryOAuthDevTicketStore.class)
public class InMemoryOAuthDevTicketStore implements OAuthDevTicketStore {

    private final Map<String, Ticket> store = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    @Autowired
    public InMemoryOAuthDevTicketStore(@Value("${openframe.gateway.oauth.dev-ticket-ttl-seconds:120}") long ttlSeconds) {
        this(Duration.ofSeconds(ttlSeconds), Clock.systemUTC());
    }

    public InMemoryOAuthDevTicketStore(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    @Override
    public Mono<String> createTicket(TokenResponse tokens) {
        Instant now = clock.instant();
        store.values().removeIf(ticket -> ticket.isExpiredAt(now));
        String id = UUID.randomUUID().toString();
        store.put(id, new Ticket(tokens, now.plus(ttl)));
        return Mono.just(id);
    }

    @Override
    public Mono<TokenResponse> consumeTicket(String ticketId) {
        Ticket removed = store.remove(ticketId);
        return Mono.justOrEmpty(removed)
                .filter(ticket -> !ticket.isExpiredAt(clock.instant()))
                .map(Ticket::tokens);
    }

    int size() {
        return store.size();
    }

    private record Ticket(TokenResponse tokens, Instant expiresAt) {
        boolean isExpiredAt(Instant now) {
            return !now.isBefore(expiresAt);
        }
    }
}
