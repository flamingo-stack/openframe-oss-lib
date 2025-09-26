package com.openframe.security.oauth.service;

import com.openframe.security.oauth.dto.TokenResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnMissingBean(value = OAuthDevTicketStore.class, ignored = InMemoryOAuthDevTicketStore.class)
public class InMemoryOAuthDevTicketStore implements OAuthDevTicketStore {

    private final Map<String, TokenResponse> store = new ConcurrentHashMap<>();

    @Override
    public String createTicket(TokenResponse tokens) {
        String id = UUID.randomUUID().toString();
        store.put(id, tokens);
        return id;
    }

    @Override
    public TokenResponse consumeTicket(String ticketId) {
        return store.remove(ticketId);
    }
}


