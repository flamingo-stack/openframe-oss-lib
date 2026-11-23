package com.openframe.gateway.config.ws.nats.policy;

import com.openframe.gateway.config.ws.nats.NatsClientKind;

import java.util.List;

/**
 * Subject patterns a product built on this gateway adds to the OSS defaults — the saas gateway
 * contributes its chat stream this way. Contributed patterns are always added, whatever the
 * configuration sets; the same {@code {id}}, {@code *} and {@code >} rules apply.
 */
public interface NatsSubjectPatternContributor {

    List<String> subscribePatternsFor(NatsClientKind kind);

    List<String> publishPatternsFor(NatsClientKind kind);
}
