package com.openframe.api.config;

import com.netflix.graphql.dgs.DgsScalar;
import graphql.GraphQLContext;
import graphql.execution.CoercedVariables;
import graphql.language.Value;
import graphql.schema.Coercing;
import graphql.schema.CoercingParseLiteralException;
import graphql.schema.CoercingParseValueException;
import graphql.schema.CoercingSerializeException;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Opaque pass-through: maps and lists serialize as-is; used for `Notification.attributes`. */
@DgsScalar(name = "JSON")
@Component
public class JsonScalarConfig implements Coercing<Object, Object> {

    @Override
    public Object serialize(@NotNull Object dataFetcherResult,
                            @NotNull GraphQLContext graphQLContext,
                            @NotNull Locale locale) throws CoercingSerializeException {
        return dataFetcherResult;
    }

    @Override
    public Object parseValue(@NotNull Object input,
                             @NotNull GraphQLContext graphQLContext,
                             @NotNull Locale locale) throws CoercingParseValueException {
        return input;
    }

    @Override
    public Object parseLiteral(@NotNull Value<?> input,
                               @NotNull CoercedVariables variables,
                               @NotNull GraphQLContext graphQLContext,
                               @NotNull Locale locale) throws CoercingParseLiteralException {
        throw new CoercingParseLiteralException("JSON literals are not supported as arguments");
    }
}
