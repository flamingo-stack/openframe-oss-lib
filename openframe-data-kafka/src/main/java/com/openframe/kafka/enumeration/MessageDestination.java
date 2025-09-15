package com.openframe.kafka.enumeration;

import lombok.Getter;

@Getter
public enum MessageDestination {

    TO_TENANT("to-tenant"),
    FROM_TENANT("from-tenant"),
    SAAS_TO_SAAS("saas-to-saas");

    private String value;

    MessageDestination(String value) {
        this.value = value;
    }

}
