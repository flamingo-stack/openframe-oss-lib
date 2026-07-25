package com.openframe.core.email;

/**
 * Response body of the disposable-domain endpoint, e.g. {@code {"disposable": true}}.
 */
public record DisposableDomainResponse(boolean disposable) {
}
