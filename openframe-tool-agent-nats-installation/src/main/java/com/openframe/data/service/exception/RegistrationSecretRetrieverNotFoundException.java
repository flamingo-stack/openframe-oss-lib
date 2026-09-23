package com.openframe.data.service.exception;

public class RegistrationSecretRetrieverNotFoundException extends RuntimeException {

    public RegistrationSecretRetrieverNotFoundException(String toolId) {
        super("No tool agent registration secret retriver found for " + toolId);
    }

}
