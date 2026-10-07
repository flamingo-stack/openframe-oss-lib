package com.openframe.core.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
@RequiredArgsConstructor
public class AgentRegistrationSecretGenerator {

    private static final Integer KEY_LENGTH = 32;

    // Alphanumeric only: the key is pasted unquoted into install commands, and a leading '-' was parsed as a CLI flag
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        StringBuilder key = new StringBuilder(KEY_LENGTH);
        for (int i = 0; i < KEY_LENGTH; i++) {
            key.append(ALPHABET.charAt(secureRandom.nextInt(ALPHABET.length())));
        }
        return key.toString();
    }

}
