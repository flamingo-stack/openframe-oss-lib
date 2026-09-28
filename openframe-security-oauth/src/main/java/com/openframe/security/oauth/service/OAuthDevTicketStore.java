package com.openframe.security.oauth.service;

import com.openframe.security.oauth.dto.TokenResponse;
import reactor.core.publisher.Mono;

// Dev-only ticket store for passing OAuth tokens back on localhost; default impl is in-memory
public interface OAuthDevTicketStore {

    Mono<String> createTicket(TokenResponse tokens);

    Mono<TokenResponse> consumeTicket(String ticketId);
}


