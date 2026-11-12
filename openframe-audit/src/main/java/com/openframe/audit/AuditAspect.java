package com.openframe.audit;

import com.openframe.data.document.audit.AuditTargetType;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;

@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditCapture auditCapture;
    private final AuditExpressions expressions;

    @Around("@annotation(com.openframe.audit.Audited)")
    public Object capture(ProceedingJoinPoint joinPoint) throws Throwable {
        Method method = AopUtils.getMostSpecificMethod(((MethodSignature) joinPoint.getSignature()).getMethod(),
                joinPoint.getTarget().getClass());
        Audited audited = AnnotationUtils.findAnnotation(method, Audited.class);
        Object[] arguments = joinPoint.getArgs();
        String idExpression = audited.targetId();
        String condition = audited.condition();
        String tenantExpression = audited.tenantId();
        String nameExpression = audited.targetName();
        String organizationExpression = audited.organizationId();
        String deviceExpression = audited.deviceId();
        boolean idFromResult = expressions.readsResult(idExpression);
        boolean idFromArguments = StringUtils.hasText(idExpression) && !idFromResult;
        AuditTargetType targetType = audited.targetType().length > 0
                ? audited.targetType()[0]
                : audited.action().getTargetType();
        AuditCall call = new AuditCall(
                audited.action(),
                targetType,
                () -> idFromArguments ? expressions.evaluate(idExpression, method, arguments, null) : null,
                result -> idFromResult && result != null
                        ? expressions.evaluate(idExpression, method, arguments, result) : null,
                idFromResult,
                result -> expressions.details(audited.details(), method, arguments, result),
                audited.compare(),
                result -> records(condition, method, arguments, result),
                result -> valueAfterCall(tenantExpression, method, arguments, result),
                result -> valueAfterCall(nameExpression, method, arguments, result),
                result -> valueAfterCall(organizationExpression, method, arguments, result),
                result -> valueAfterCall(deviceExpression, method, arguments, result));
        return auditCapture.capture(call, joinPoint::proceed);
    }

    private boolean records(String condition, Method method, Object[] arguments, Object result) {
        if (!StringUtils.hasText(condition)) {
            return true;
        }
        boolean unknown = result == null && expressions.readsResult(condition);
        return !unknown && expressions.test(condition, method, arguments, result);
    }

    private String valueAfterCall(String expression, Method method, Object[] arguments, Object result) {
        boolean unknown = !StringUtils.hasText(expression) || result == null && expressions.readsResult(expression);
        return unknown ? null : expressions.evaluate(expression, method, arguments, result);
    }
}
