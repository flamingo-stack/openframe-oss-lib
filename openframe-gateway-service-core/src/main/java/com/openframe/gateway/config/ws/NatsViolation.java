package com.openframe.gateway.config.ws;

/**
 * What a NATS client tried that its policy does not allow: the operation ({@code SUB}, {@code PUB},
 * {@code HPUB}, {@code CONNECT} or {@code PROTOCOL}) and the subject, credential field or parse
 * problem behind it.
 */
record NatsViolation(String operation, String detail) {
}
