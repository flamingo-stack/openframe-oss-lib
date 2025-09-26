package com.openframe.security.oauth.service;

import com.openframe.security.oauth.dto.TokenResponse;

/**
 * Store for development-only OAuth exchange tickets used to pass tokens back on localhost.
 * Default implementation is in-memory; applications can provide their own bean.
 */
public interface OAuthDevTicketStore {

    /**
     * Creates a single-use ticket associated with the provided tokens and returns the ticket id.
     */
    String createTicket(TokenResponse tokens);

    /**
     * Consumes (retrieves and removes) the tokens for the given ticket id. Returns null if not found.
     */
    TokenResponse consumeTicket(String ticketId);
}


