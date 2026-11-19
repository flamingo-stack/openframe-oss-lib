package com.openframe.security.oauth.service;

import com.openframe.security.oauth.dto.TokenResponse;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryOAuthDevTicketStoreTest {

    private static final TokenResponse TOKENS = new TokenResponse("access", "refresh", "Bearer", 300, "openid");
    private static final Duration TTL = Duration.ofSeconds(120);

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-13T10:00:00Z"));
    private final InMemoryOAuthDevTicketStore store = new InMemoryOAuthDevTicketStore(TTL, clock);

    @Test
    void shouldHonorTicketOnceJustBeforeTtlAndRejectItAtTtl() {
        String early = store.createTicket(TOKENS).block();
        String late = store.createTicket(TOKENS).block();
        clock.advance(TTL.minusSeconds(1));

        assertThat(store.consumeTicket(early).block()).isEqualTo(TOKENS);
        assertThat(store.consumeTicket(early).block()).isNull();

        clock.advance(Duration.ofSeconds(1));
        assertThat(store.consumeTicket(late).block()).isNull();
    }

    @Test
    void shouldEvictExpiredTicketsOnCreate() {
        store.createTicket(TOKENS).block();
        store.createTicket(TOKENS).block();
        clock.advance(TTL);

        store.createTicket(TOKENS).block();

        assertThat(store.size()).isEqualTo(1);
    }
}
