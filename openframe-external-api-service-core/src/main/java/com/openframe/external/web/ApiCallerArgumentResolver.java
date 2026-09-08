package com.openframe.external.web;

import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;

/** Binds {@link ApiCaller} parameters from the gateway-injected identity headers. */
public class ApiCallerArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return ApiCaller.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        return new ApiCaller(webRequest.getHeader(X_USER_ID), webRequest.getHeader(X_API_KEY_ID));
    }
}
