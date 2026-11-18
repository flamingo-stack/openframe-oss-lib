package com.openframe.api.service.agentkey;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/**
 * Lets controllers take {@link AgentKeyType} straight from the path ({@code log}, {@code registration});
 * an unknown value becomes a 400 type mismatch.
 */
@Component
public class AgentKeyTypeConverter implements Converter<String, AgentKeyType> {

    @Override
    public AgentKeyType convert(String source) {
        return AgentKeyType.fromPath(source);
    }
}
