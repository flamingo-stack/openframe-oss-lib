package com.openframe.publishing.repository;

import com.openframe.publishing.fixture.Widgets.UnversionedWidget;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UnorderedWidgetRepository extends MongoRepository<UnversionedWidget, String> {
}
