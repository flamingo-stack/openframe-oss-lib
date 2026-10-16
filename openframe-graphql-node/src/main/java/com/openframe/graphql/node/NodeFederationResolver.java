package com.openframe.graphql.node;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.federation.DefaultDgsFederationResolver;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandler;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import graphql.execution.DataFetcherExceptionHandlerResult;
import graphql.execution.DataFetcherResult;
import graphql.execution.SimpleDataFetcherExceptionHandler;
import graphql.schema.DataFetcher;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.TypeResolver;
import lombok.RequiredArgsConstructor;
import org.dataloader.Try;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RequiredArgsConstructor
public class NodeFederationResolver extends DefaultDgsFederationResolver {

    private static final String REPRESENTATIONS = "representations";

    private final NodeEntityFinder entityFinder;
    private final EntityCallerAuthorizer callerAuthorizer;
    private final NodeTypeResolver nodeTypeResolver;

    @Override
    public DataFetcher<Object> entitiesFetcher() {
        return this::fetchEntities;
    }

    @Override
    public TypeResolver typeResolver() {
        return nodeTypeResolver::resolveObjectType;
    }

    // The caller is authorized once, before any lookup; a refusal fails every representation, as a per-type check did.
    private DataFetcherResult<List<Object>> fetchEntities(DataFetchingEnvironment environment) {
        List<Map<String, Object>> representations = environment.getArgument(REPRESENTATIONS);
        Try<AuthPrincipal> caller = Try.tryCall(callerAuthorizer::authorizeCaller);
        List<Try<Optional<Object>>> outcomes = representations.stream()
                .map(representation -> findEntity(caller, representation))
                .toList();
        List<Object> entities = outcomes.stream()
                .map(NodeFederationResolver::entityOrNull)
                .toList();
        List<GraphQLError> errors = errorsOf(environment, outcomes);
        return DataFetcherResult.<List<Object>>newResult()
                .data(entities)
                .errors(errors)
                .build();
    }

    private Try<Optional<Object>> findEntity(Try<AuthPrincipal> caller, Map<String, Object> representation) {
        return caller.flatMap(principal -> Try.tryCall(() -> entityFinder.findEntity(principal, representation)));
    }

    private static Object entityOrNull(Try<Optional<Object>> outcome) {
        Optional<Object> noEntity = Optional.empty();
        Optional<Object> entity = outcome.orElse(noEntity);
        return entity.orElse(null);
    }

    private List<GraphQLError> errorsOf(DataFetchingEnvironment environment, List<Try<Optional<Object>>> outcomes) {
        List<GraphQLError> errors = new ArrayList<>();
        for (int index = 0; index < outcomes.size(); index++) {
            Try<Optional<Object>> outcome = outcomes.get(index);
            if (outcome.isFailure()) {
                Throwable failure = outcome.getThrowable();
                List<GraphQLError> entityErrors = errorsAt(environment, index, failure);
                errors.addAll(entityErrors);
            }
        }
        return errors;
    }

    private List<GraphQLError> errorsAt(DataFetchingEnvironment environment, int index, Throwable failure) {
        DgsDataFetchingEnvironment entityEnvironment = createDataFetchingEnvironmentWithPath(environment, index);
        DataFetcherExceptionHandlerParameters parameters = DataFetcherExceptionHandlerParameters.newExceptionParameters()
                .dataFetchingEnvironment(entityEnvironment)
                .exception(failure)
                .build();
        DataFetcherExceptionHandler handler = exceptionHandler();
        DataFetcherExceptionHandlerResult result = handler.handleException(parameters).join();
        return result.getErrors();
    }

    private DataFetcherExceptionHandler exceptionHandler() {
        Optional<DataFetcherExceptionHandler> configured = getDgsExceptionHandler();
        return configured.orElseGet(SimpleDataFetcherExceptionHandler::new);
    }
}
