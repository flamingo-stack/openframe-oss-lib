package com.openframe.audit;

import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import lombok.RequiredArgsConstructor;
import org.springframework.context.expression.MethodBasedEvaluationContext;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class AuditExpressions {

    private static final String RESULT_VARIABLE = "result";
    private static final Pattern RESULT_REFERENCE = Pattern.compile("#" + RESULT_VARIABLE + "\\b");
    private static final String DETAIL_SEPARATOR = "=";

    private final RelayIdCodec relayIds;
    private final ExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer parameterNames = new DefaultParameterNameDiscoverer();
    private final Map<String, Expression> parsedExpressions = new ConcurrentHashMap<>();

    public boolean readsResult(String expression) {
        return RESULT_REFERENCE.matcher(expression).find();
    }

    public String evaluate(String expression, Method method, Object[] arguments, Object result) {
        Object value = valueOf(expression, method, arguments, result);
        return value == null ? null : value.toString();
    }

    public boolean test(String expression, Method method, Object[] arguments, Object result) {
        return Boolean.TRUE.equals(valueOf(expression, method, arguments, result));
    }

    public Map<String, Object> details(String[] entries, Method method, Object[] arguments, Object result) {
        Map<String, Object> details = new LinkedHashMap<>();
        MethodBasedEvaluationContext context = context(method, arguments, result);
        Arrays.stream(entries)
                .filter(entry -> result != null || !readsResult(entry))
                .forEach(entry -> {
                    int separator = entry.indexOf(DETAIL_SEPARATOR);
                    String key = entry.substring(0, separator).trim();
                    String expression = entry.substring(separator + 1).trim();
                    details.put(key, parsed(expression).getValue(context));
                });
        return details;
    }

    public String rawId(String id) {
        return relayIds.parse(id).map(ParsedRelayId::getRawId).orElse(id);
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
