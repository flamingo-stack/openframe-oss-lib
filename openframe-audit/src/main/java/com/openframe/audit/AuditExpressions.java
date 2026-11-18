package com.openframe.audit;

import com.openframe.data.model.audit.AuditEntry;
import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.expression.MethodBasedEvaluationContext;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuditExpressions {

    static final String RESULT_VARIABLE = "result";
    static final String ROOT_VARIABLE = "root";
    static final Set<String> BUILT_IN_VARIABLES = Set.of(RESULT_VARIABLE, ROOT_VARIABLE, "this");
    private static final Pattern VARIABLE = Pattern.compile("#(\\w+)");
    static final String DETAIL_SEPARATOR = "=";

    private final RelayIdCodec relayIdCodec;
    private final ExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer parameterNames = new DefaultParameterNameDiscoverer();
    private final Map<String, Expression> parsedExpressions = new ConcurrentHashMap<>();

    public boolean isFromResult(String expression) {
        return variablesOf(expression).contains(RESULT_VARIABLE);
    }

    static Set<String> variablesOf(String expression) {
        return VARIABLE.matcher(expression).results().map(match -> match.group(1)).collect(Collectors.toSet());
    }

    public String evaluate(String expression, Method method, Object[] arguments, Object result) {
        if (!StringUtils.hasText(expression) || isFromMissingResult(expression, result)) {
            return null;
        }
        Object value = valueOf(expression, method, arguments, result);
        if (value == null) {
            return null;
        }
        String text = AuditEntry.plainValue(value).toString();
        return StringUtils.hasText(text) ? text : null;
    }

    public boolean isConditionMet(String condition, Method method, Object[] arguments, Object result) {
        Object met = valueOf(condition, method, arguments, result);
        return met != null && (Boolean) met;
    }

    public Map<String, Object> details(String[] entries, Method method, Object[] arguments, Object result) {
        Map<String, Object> details = new LinkedHashMap<>();
        MethodBasedEvaluationContext context = context(method, arguments, result);
        Arrays.stream(entries)
                .filter(entry -> !isFromMissingResult(entry, result))
                .forEach(entry -> {
                    try {
                        int separator = entry.indexOf(DETAIL_SEPARATOR);
                        String expression = entry.substring(separator + 1).trim();
                        details.put(entry.substring(0, separator).trim(), parsed(expression).getValue(context));
                    } catch (RuntimeException e) {
                        log.error("Audit detail '{}' of {} dropped: {}", entry, method.getName(), e.toString());
                    }
                });
        return details;
    }

    public Object rawId(Object id) {
        return switch (id) {
            case Collection<?> ids -> ids.stream().map(this::rawId).toList();
            case String text -> relayIdCodec.parse(text).map(ParsedRelayId::getRawId).orElse(text);
            case null, default -> id;
        };
    }

    private static boolean isFromMissingResult(String expression, Object result) {
        Set<String> variables = variablesOf(expression);
        return result == null && variables.contains(RESULT_VARIABLE) && BUILT_IN_VARIABLES.containsAll(variables);
    }

    private Object valueOf(String expression, Method method, Object[] arguments, Object result) {
        return parsed(expression).getValue(context(method, arguments, result));
    }

    private Expression parsed(String expression) {
        return parsedExpressions.computeIfAbsent(expression, parser::parseExpression);
    }

    private MethodBasedEvaluationContext context(Method method, Object[] arguments, Object result) {
        MethodBasedEvaluationContext context = new MethodBasedEvaluationContext(this, method, arguments,
                parameterNames);
        context.setVariable(RESULT_VARIABLE, result);
        return context;
    }
}
