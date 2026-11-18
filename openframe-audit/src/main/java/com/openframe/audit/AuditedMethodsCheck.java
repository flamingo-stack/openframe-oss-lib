package com.openframe.audit;

import com.openframe.data.document.audit.AuditKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.SpringProxy;
import org.springframework.aop.framework.Advised;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.core.DecoratingProxy;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.core.ResolvableType;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.expression.ParseException;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;
import org.springframework.util.ClassUtils;
import org.springframework.util.ReflectionUtils;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.openframe.audit.AuditExpressions.BUILT_IN_VARIABLES;
import static com.openframe.audit.AuditExpressions.DETAIL_SEPARATOR;
import static com.openframe.audit.AuditExpressions.RESULT_VARIABLE;
import static com.openframe.audit.AuditExpressions.ROOT_VARIABLE;
import static com.openframe.audit.AuditExpressions.variablesOf;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuditedMethodsCheck implements SmartInitializingSingleton {

    private static final Set<Class<?>> PROXY_INTERFACES =
            Set.of(SpringProxy.class, Advised.class, DecoratingProxy.class);
    private static final Set<String> ASYNC_RESULTS = Set.of("java.util.concurrent.Future",
            "java.util.concurrent.CompletionStage", "java.util.concurrent.Callable",
            "org.reactivestreams.Publisher",
            "org.springframework.web.context.request.async.DeferredResult",
            "org.springframework.web.context.request.async.WebAsyncTask",
            "org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter",
            "org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody");
    private static final int TYPE_ARGUMENT_LEVELS = 3;

    private final ConfigurableListableBeanFactory beanFactory;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer parameterNames = new DefaultParameterNameDiscoverer();

    @Override
    public void afterSingletonsInstantiated() {
        if (!enabled) {
            return;
        }
        List<String> problems = new ArrayList<>();
        int checked = 0;
        for (String beanName : beanFactory.getBeanDefinitionNames()) {
            MarkedBean marked = markedBeanOf(beanName);
            if (marked == null) {
                continue;
            }
            Object bean = isCreatedOnDemand(beanName) ? null : beanFactory.getBean(beanName);
            marked.auditedMethods()
                    .forEach((method, audited) -> problems.addAll(problemsOf(bean, marked.type(), method, audited)));
            checked += marked.auditedMethods().size();
        }
        Assert.state(problems.isEmpty(), () -> "@Audited methods that would record nothing or record wrong:\n" + String.join("\n", problems));
        log.info("Checked {} @Audited methods", checked);
    }

    private boolean isCreatedOnDemand(String beanName) {
        BeanDefinition definition = beanFactory.getBeanDefinition(beanName);
        return !definition.isSingleton() || definition.isLazyInit();
    }

    private MarkedBean markedBeanOf(String beanName) {
        try {
            Class<?> type = beanFactory.getType(beanName, false);
            if (type == null) {
                return null;
            }
            Class<?> userClass = userClassOf(type);
            Map<Method, Audited> auditedMethods = auditedMethodsOf(userClass);
            return auditedMethods.isEmpty() ? null : new MarkedBean(userClass, auditedMethods);
        } catch (RuntimeException | LinkageError e) {
            log.warn("Bean {} not checked for @Audited methods, its class cannot be read: {}", beanName, e.toString());
            return null;
        }
    }

    private static Class<?> userClassOf(Class<?> type) {
        if (!Proxy.isProxyClass(type)) {
            return ClassUtils.getUserClass(type);
        }
        List<Class<?>> userInterfaces = Arrays.stream(type.getInterfaces())
                .filter(proxied -> !PROXY_INTERFACES.contains(proxied))
                .toList();
        return userInterfaces.size() == 1 ? userInterfaces.getFirst() : type;
    }

    private record MarkedBean(Class<?> type, Map<Method, Audited> auditedMethods) {
    }

    private static Map<Method, Audited> auditedMethodsOf(Class<?> type) {
        Map<Method, Audited> auditedMethods = new LinkedHashMap<>();
        for (Method method : ReflectionUtils.getUniqueDeclaredMethods(type, declared -> !declared.isBridge())) {
            Audited audited = AnnotationUtils.findAnnotation(method, Audited.class);
            if (audited != null) {
                auditedMethods.put(method, audited);
            }
        }
        return auditedMethods;
    }

    private List<String> problemsOf(Object bean, Class<?> beanClass, Method method, Audited audited) {
        String where = method.getDeclaringClass().getSimpleName() + "." + method.getName();
        List<String> problems = new ArrayList<>();
        int modifiers = method.getModifiers();
        if (Modifier.isPrivate(modifiers) || Modifier.isFinal(modifiers) || Modifier.isStatic(modifiers)) {
            problems.add(where + " is private, final or static, so the aspect never sees it");
        }
        if (!method.isAnnotationPresent(Audited.class)) {
            problems.add(where + " inherits @Audited from an interface or an overridden method, which the aspect "
                    + "never sees; put it on the method itself");
        }
        if (bean != null && !AopUtils.isAopProxy(bean)) {
            problems.add(where + " belongs to a bean that is not a Spring proxy, so its calls are never recorded");
        }
        if (isOrWrapsAsyncResult(ResolvableType.forMethodReturnType(method, beanClass), TYPE_ARGUMENT_LEVELS)) {
            problems.add(where + " returns work that finishes later, so the event would be written too early");
        }
        if (AnnotatedElementUtils.hasAnnotation(method, Async.class)
                || AnnotatedElementUtils.hasAnnotation(beanClass, Async.class)) {
            problems.add(where + " runs on another thread (@Async), so the event loses who called it; put @Audited on "
                    + "the method that calls it");
        }
        if (audited.targetType().length == 0 && audited.action().getTargetType() == null) {
            problems.add(where + " names no target type and its action " + audited.action().getName()
                    + " has none, so its events are never stored");
        }
        if (audited.targetType().length > 1) {
            problems.add(where + " names " + audited.targetType().length + " target types, only one is used");
        }
        Arrays.stream(audited.details())
                .filter(detail -> !hasKeyAndExpression(detail))
                .forEach(detail -> problems.add(where + ": detail '" + detail
                        + "' has no key or no expression, write it as key = expression"));
        repeatedDetailKeys(audited).forEach(key ->
                problems.add(where + ": detail key '" + key + "' appears twice, only the last one is stored"));
        String[] names = parameterNames.getParameterNames(method);
        if (names == null) {
            problems.add(where + " was compiled without parameter names, so its expressions cannot read them");
            return problems;
        }
        Set<String> known = Set.of(names);
        Set<String> read = expressionsOf(audited).map(AuditExpressions::variablesOf)
                .flatMap(Set::stream)
                .collect(Collectors.toSet());
        Stream.of(RESULT_VARIABLE, ROOT_VARIABLE)
                .filter(name -> known.contains(name) && read.contains(name))
                .forEach(name -> problems.add(where + " has a parameter named " + name + ", but #" + name
                        + " means something else in an expression; rename the parameter"));
        boolean returnsNothing = method.getReturnType() == void.class || method.getReturnType() == Void.class;
        if (!returnsNothing) {
            problems.addAll(targetIdProblemsOf(where, audited, known));
        }
        expressionsOf(audited)
                .forEach(expression -> problems.addAll(problemsOf(where, expression, known, returnsNothing)));
        return problems;
    }

    private static List<String> targetIdProblemsOf(String where, Audited audited, Set<String> parameters) {
        String targetId = audited.targetId();
        Set<String> variables = variablesOf(targetId);
        if (!variables.contains(RESULT_VARIABLE)) {
            return List.of();
        }
        List<String> problems = new ArrayList<>();
        if (variables.stream().filter(variable -> !RESULT_VARIABLE.equals(variable)).anyMatch(parameters::contains)) {
            problems.add(where + ": targetId '" + targetId + "' reads both #result and an argument; read it from one "
                    + "of them");
        }
        boolean comparedUpdate = audited.compare() && audited.action().getKind() == AuditKind.CHANGE
                && !audited.action().getName().endsWith(AuditedMethodRunner.CREATE_SUFFIX);
        if (comparedUpdate) {
            problems.add(where + ": targetId '" + targetId + "' reads #result, so the record cannot be read before "
                    + "the call and the changes of " + audited.action().getName() + " would be lost; for an update read "
                    + "the id from an argument, for an action that creates its record set compare = false");
        }
        return problems;
    }

    private List<String> problemsOf(String where, String expression, Set<String> parameters, boolean returnsNothing) {
        List<String> problems = new ArrayList<>();
        try {
            parser.parseExpression(expression);
        } catch (ParseException e) {
            problems.add(where + ": '" + expression + "' does not parse: " + e.getMessage());
            return problems;
        }
        for (String variable : variablesOf(expression)) {
            if (!parameters.contains(variable) && !BUILT_IN_VARIABLES.contains(variable)) {
                problems.add(where + ": '" + expression + "' names #" + variable + ", which the method does not have");
            }
            if (RESULT_VARIABLE.equals(variable) && returnsNothing) {
                problems.add(where + ": '" + expression + "' reads #result, but the method returns nothing");
            }
        }
        return problems;
    }

    private static Stream<String> expressionsOf(Audited audited) {
        Stream<String> single = Stream.of(audited.targetId(), audited.condition(), audited.tenantId(),
                audited.targetName(), audited.organizationId(), audited.deviceId());
        Stream<String> details = Arrays.stream(audited.details())
                .map(detail -> detail.substring(detail.indexOf(DETAIL_SEPARATOR) + 1).trim());
        return Stream.concat(single, details).filter(StringUtils::hasText);
    }

    private static List<String> repeatedDetailKeys(Audited audited) {
        return Arrays.stream(audited.details())
                .filter(AuditedMethodsCheck::hasKeyAndExpression)
                .collect(Collectors.groupingBy(detail -> detail.substring(0, detail.indexOf(DETAIL_SEPARATOR)).trim(),
                        LinkedHashMap::new, Collectors.counting()))
                .entrySet().stream()
                .filter(keyCount -> keyCount.getValue() > 1)
                .map(Map.Entry::getKey)
                .toList();
    }

    private static boolean hasKeyAndExpression(String detail) {
        int separator = detail.indexOf(DETAIL_SEPARATOR);
        return separator > 0 && StringUtils.hasText(detail.substring(0, separator))
                && StringUtils.hasText(detail.substring(separator + 1));
    }

    private static boolean isOrWrapsAsyncResult(ResolvableType type, int levels) {
        return isAsyncResult(type.toClass()) || levels > 0 && Arrays.stream(type.getGenerics())
                .anyMatch(argument -> isOrWrapsAsyncResult(argument, levels - 1));
    }

    private static boolean isAsyncResult(Class<?> type) {
        return ASYNC_RESULTS.stream()
                .anyMatch(name -> ClassUtils.isPresent(name, type.getClassLoader())
                        && ClassUtils.resolveClassName(name, type.getClassLoader()).isAssignableFrom(type));
    }
}
