package com.openframe.publishing.repository;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// Internal: marks a PublishedRepositoryWrites method whose deleted documents are published as deleted.
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface PublishesDelete {

    PublishedWrite value();
}
