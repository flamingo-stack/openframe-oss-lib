package com.openframe.core.email;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/**
 * Declarative client for the external disposable-domain lookup. The base URL comes from
 * {@code openframe.email-domain-policy.disposable-check.url}, so the path here is just the domain.
 */
@HttpExchange(accept = "application/json")
public interface DisposableDomainHttpClient {

    @GetExchange("/{domain}")
    DisposableDomainResponse check(@PathVariable String domain);
}
