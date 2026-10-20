package com.openframe.publishing.repository;

import com.openframe.publishing.api.PublishingMongoRepository;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface WidgetRepository extends PublishingMongoRepository<Widget, String, WidgetSpec>, WidgetCustomRepository {

    List<Widget> deleteByName(String name);

    // Not a delete by name: only @Query(delete = true) says so.
    @Query(value = "{ 'name': ?0 }", delete = true)
    List<Widget> purgeByQuery(String name);

    List<Widget> findByName(String name);
}
