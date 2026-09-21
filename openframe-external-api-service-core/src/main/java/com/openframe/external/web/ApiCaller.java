package com.openframe.external.web;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Identity the gateway attached to an external API request after validating the API key:
 * the key's owner ({@code X-User-Id}) and the key itself ({@code X-API-Key-Id}). Resolved once
 * per request by {@link ApiCallerArgumentResolver}, so controllers declare a single parameter
 * instead of two header bindings.
 */
@Getter
@AllArgsConstructor
public class ApiCaller {
    private final String userId;
    private final String apiKeyId;
}

