package com.openframe.external.web;

/**
 * Identity the gateway attached to an external API request after validating the API key:
 * the key's owner ({@code X-User-Id}) and the key itself ({@code X-API-Key-Id}). Resolved once
 * per request by {@link ApiCallerArgumentResolver}, so controllers declare a single parameter
 * instead of two header bindings.
 */
public record ApiCaller(String userId, String apiKeyId) {
}
