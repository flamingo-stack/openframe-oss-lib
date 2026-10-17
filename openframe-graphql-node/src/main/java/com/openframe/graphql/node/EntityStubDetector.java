package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import graphql.language.BooleanValue;
import graphql.language.StringValue;
import graphql.schema.GraphQLAppliedDirective;
import graphql.schema.GraphQLAppliedDirectiveArgument;
import graphql.schema.GraphQLFieldDefinition;
import graphql.schema.GraphQLNamedOutputType;
import graphql.schema.GraphQLObjectType;
import graphql.schema.GraphQLSchema;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// A reference stub implements Node, has only unresolvable keys and no field outside them: another subgraph owns it.
public class EntityStubDetector {

    private static final String NODE_INTERFACE = "Node";
    private static final String KEY_DIRECTIVE = "key";
    private static final String FIELDS_ARGUMENT = "fields";
    private static final String RESOLVABLE_ARGUMENT = "resolvable";
    private static final String EMPTY_FIELD_SET = "";
    private static final Pattern FIELD_SET_DELIMITERS = Pattern.compile("[\\s{}]+");

    public boolean isReferenceStub(GraphQLSchema schema, NodeType type) {
        String typeName = type.getGraphqlTypeName();
        GraphQLObjectType objectType = schema.getObjectType(typeName);
        return objectType != null && isNodeStub(objectType);
    }

    private static boolean isNodeStub(GraphQLObjectType objectType) {
        List<GraphQLAppliedDirective> keys = objectType.getAppliedDirectives(KEY_DIRECTIVE);
        return implementsNode(objectType) && hasOnlyUnresolvableKeys(keys) && declaresOnlyKeyFields(objectType, keys);
    }

    private static boolean implementsNode(GraphQLObjectType objectType) {
        List<GraphQLNamedOutputType> interfaces = objectType.getInterfaces();
        return interfaces.stream()
                .map(GraphQLNamedOutputType::getName)
                .anyMatch(NODE_INTERFACE::equals);
    }

    private static boolean hasOnlyUnresolvableKeys(List<GraphQLAppliedDirective> keys) {
        return !keys.isEmpty() && keys.stream().noneMatch(EntityStubDetector::isResolvable);
    }

    // Read like federation-jvm does: a key without an explicit resolvable: false is resolvable.
    private static boolean isResolvable(GraphQLAppliedDirective key) {
        GraphQLAppliedDirectiveArgument resolvable = key.getArgument(RESOLVABLE_ARGUMENT);
        return resolvable == null || !isFalseLiteral(resolvable);
    }

    private static boolean isFalseLiteral(GraphQLAppliedDirectiveArgument argument) {
        Object value = argument.getArgumentValue().getValue();
        return value instanceof BooleanValue literal && !literal.isValue();
    }

    private static boolean declaresOnlyKeyFields(GraphQLObjectType objectType, List<GraphQLAppliedDirective> keys) {
        Set<String> keyFields = keys.stream()
                .flatMap(EntityStubDetector::fieldNamesOf)
                .collect(Collectors.toSet());
        List<GraphQLFieldDefinition> fields = objectType.getFieldDefinitions();
        return fields.stream()
                .map(GraphQLFieldDefinition::getName)
                .allMatch(keyFields::contains);
    }

    private static Stream<String> fieldNamesOf(GraphQLAppliedDirective key) {
        GraphQLAppliedDirectiveArgument fields = key.getArgument(FIELDS_ARGUMENT);
        String fieldSet = fieldSetOf(fields);
        String[] fieldNames = FIELD_SET_DELIMITERS.split(fieldSet);
        return Arrays.stream(fieldNames)
                .filter(StringUtils::hasText);
    }

    private static String fieldSetOf(GraphQLAppliedDirectiveArgument fields) {
        Object value = fields.getArgumentValue().getValue();
        if (value instanceof StringValue literal) {
            return literal.getValue();
        }
        return EMPTY_FIELD_SET;
    }
}
