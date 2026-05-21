package com.openframe.debezium.naming;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

/**
 * Default strategy preserving pre-existing behavior: the name from the tool
 * configuration is used verbatim, no version suffix. Tenant cluster keeps this
 * strategy and sees no behavior change.
 */
@Component
@ConditionalOnMissingBean(ConnectorNameStrategy.class)
public class IdentityConnectorNameStrategy implements ConnectorNameStrategy {

    @Override
    public boolean matchesBase(String baseName, String connectorName) {
        return Objects.equals(baseName, connectorName);
    }

    @Override
    public String extractBaseName(String connectorName) {
        return connectorName;
    }

    @Override
    public String resolveNextName(String baseName, List<String> existing) {
        return baseName;
    }
}
