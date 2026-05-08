package com.openframe.api.config;

import com.netflix.graphql.dgs.DgsScalar;
import graphql.GraphQLContext;
import graphql.execution.CoercedVariables;
import graphql.language.IntValue;
import graphql.language.StringValue;
import graphql.language.Value;
import graphql.schema.Coercing;
import graphql.schema.CoercingParseLiteralException;
import graphql.schema.CoercingParseValueException;
import graphql.schema.CoercingSerializeException;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Custom GraphQL scalar for 64-bit Long values.
 * Used for large numbers like file sizes in bytes (which exceed Int 2.1GB cap).
 *
 * @see <a href="https://ibm.github.io/graphql-specs/custom-scalars/long.html">IBM Long Scalar Spec</a>
 */
@DgsScalar(name = "Long")
@Component
public class LongScalarConfig implements Coercing<Long, Long> {

    @Override
    public Long serialize(@NotNull Object dataFetcherResult,
                          @NotNull GraphQLContext graphQLContext,
                          @NotNull Locale locale) throws CoercingSerializeException {
        if (dataFetcherResult instanceof Long longValue) {
            return longValue;
        }
        if (dataFetcherResult instanceof Number number) {
            return number.longValue();
        }
        throw new CoercingSerializeException("Unable to serialize " + dataFetcherResult + " as Long");
    }

    @Override
    public Long parseValue(@NotNull Object input,
                           @NotNull GraphQLContext graphQLContext,
                           @NotNull Locale locale) throws CoercingParseValueException {
        try {
            if (input instanceof Long longValue) {
                return longValue;
            }
            if (input instanceof Number number) {
                return number.longValue();
            }
            if (input instanceof String stringValue) {
                return Long.parseLong(stringValue);
            }
            throw new CoercingParseValueException("Unable to parse " + input + " as Long");
        } catch (NumberFormatException e) {
            throw new CoercingParseValueException("Unable to parse " + input + " as Long", e);
        }
    }

    @Override
    public Long parseLiteral(@NotNull Value<?> input,
                             @NotNull CoercedVariables variables,
                             @NotNull GraphQLContext graphQLContext,
                             @NotNull Locale locale) throws CoercingParseLiteralException {
        if (input instanceof IntValue intValue) {
            return intValue.getValue().longValue();
        }
        if (input instanceof StringValue stringValue) {
            try {
                return Long.parseLong(stringValue.getValue());
            } catch (NumberFormatException e) {
                throw new CoercingParseLiteralException("Unable to parse literal " + input + " as Long", e);
            }
        }
        throw new CoercingParseLiteralException("Unable to parse literal " + input + " as Long");
    }
}
