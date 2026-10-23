package com.openframe.graphql.node;

public class UnresolvableRepresentationException extends RuntimeException {

    private UnresolvableRepresentationException(String message) {
        super(message);
    }

    public static UnresolvableRepresentationException missingTypename() {
        return new UnresolvableRepresentationException("Representation has no __typename");
    }

    public static UnresolvableRepresentationException noLoaderFor(String typeName) {
        return new UnresolvableRepresentationException("No node loader for type " + typeName);
    }
}
