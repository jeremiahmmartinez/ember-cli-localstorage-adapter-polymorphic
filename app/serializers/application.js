import Ember from 'ember';
import LSSerializer from 'ember-cli-localstorage-adapter/localstorage-serializer';

export default LSSerializer.extend({
    serializeHasMany(snapshot, json, relationship){
      var attr = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this.noSerializeOptionSpecified(attr)) {
        this.serializeHasManyUnembedded(snapshot, json, relationship);
        return;
      }
      var includeIds = this.hasSerializeIdsOption(attr);
      var includeRecords = this.hasSerializeRecordsOption(attr);
      var key, hasMany;
      if (includeIds) {
        key = this.keyForRelationship(attr, relationship.kind, 'serialize');
        hasMany = snapshot.hasMany(attr);
        let jsonOutput = Ember.A(hasMany).map( rel => {
          if(isPolymorphic){
            return {id:rel.id, type:rel.modelName};
          } else {
            return rel.id;
          }
        });
        json[key] = jsonOutput;
      } else if (includeRecords) {
        key = this.keyForAttribute(attr, 'serialize');
        hasMany = snapshot.hasMany(attr);

        Ember.warn(
          `The embedded relationship '${key}' is undefined for '${snapshot.modelName}' with id '${snapshot.id}'. Please include it in your original payload.`,
          Ember.typeOf(hasMany) !== 'undefined',
          { id: 'ds.serializer.embedded-relationship-undefined' }
        );

        json[key] = Ember.A(hasMany).map( embeddedSnapshot => {
          var embeddedJson = embeddedSnapshot.record.serialize({ includeId: true });
          this.removeEmbeddedForeignKey(snapshot, embeddedSnapshot, relationship, embeddedJson);
          if(isPolymorphic){
            embeddedJson['type'] = embeddedSnapshot.modelName;
          }
          return embeddedJson;
        });
      }
    },

    serializeHasManyUnembedded(snapshot, json, relationship){
      let key = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this._shouldSerializeHasMany(snapshot, key, relationship)) {
        var hasMany = snapshot.hasMany(key);
        if (hasMany !== undefined) {
          // if provided, use the mapping provided by `attrs` in
          // the serializer
          var payloadKey = this._getMappedKey(key, snapshot.type);
          if (payloadKey === key && this.keyForRelationship) {
            payloadKey = this.keyForRelationship(key, "hasMany", "serialize");
          }

          var hasManyContent;
          if(isPolymorphic){
            //payload will be an array of objects with ids and types
            hasManyContent = hasMany.map( snapshot => {
              return { id: snapshot.id, type: snapshot.modelName };
            });
          } else {
            //payload will be an array of ids
            hasManyContent = hasMany.map( snapshot => {
              return snapshot.id;
            });
          }
          json[payloadKey] = hasManyContent;

        }
      }
    },

    serializeBelongsTo(snapshot, json, relationship){
      var attr = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this.noSerializeOptionSpecified(attr)) {
        this.serializeBelongsToUnembedded(snapshot, json, relationship);
        return;
      }
      var includeIds = this.hasSerializeIdsOption(attr);
      var includeRecords = this.hasSerializeRecordsOption(attr);
      var embeddedSnapshot = snapshot.belongsTo(attr);
      var key;
      if (includeIds) {
        key = this.keyForRelationship(attr, relationship.kind, 'serialize');
        if (!embeddedSnapshot) {
          json[key] = null;
        } else {
          if(isPolymorphic){
            json[key] = {id:embeddedSnapshot.id, type:embeddedSnapshot.modelName};
          } else {
            json[key] = embeddedSnapshot.id;
          }
        }
      } else if (includeRecords) {
        key = this.keyForAttribute(attr, 'serialize');
        if (!embeddedSnapshot) {
          json[key] = null;
        } else {
          if(isPolymorphic){
            embeddedSnapshot['type'] = embeddedSnapshot.modelName;
          }
          json[key] = embeddedSnapshot.record.serialize({ includeId: true });
          this.removeEmbeddedForeignKey(snapshot, embeddedSnapshot, relationship, json[key]);
        }
      }
    },

    serializeBelongsToUnembedded(snapshot, json, relationship){
      let key = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this._canSerialize(key)) {
        var belongsTo = snapshot.belongsTo(key);

        // if provided, use the mapping provided by `attrs` in
        // the serializer
        var payloadKey = this._getMappedKey(key, snapshot.type);
        if (payloadKey === key && this.keyForRelationship) {
          payloadKey = this.keyForRelationship(key, "belongsTo", "serialize");
        }

        if (Ember.isNone(belongsTo)) {
          //Need to check whether the id is there for new&async records
          json[payloadKey] = null;
        } else if(isPolymorphic) {
          json[payloadKey] = { id: belongsTo.id, type: belongsTo.modelName };
        } else {
          json[payloadKey] = belongsTo.id;
        }
      }
    },



    /*  serializeHasMany: function(snapshot, json, relationship) {



        var key = relationship.key;
        var payloadKey = this.keyForRelationship ? this.keyForRelationship(key, "hasMany") : key;
        var relationshipType = snapshot.type.determineRelationshipType(relationship, this.store);



        if (relationshipType === 'manyToNone' ||
          relationshipType === 'manyToMany' ||
          relationshipType === 'manyToOne') {
          json[payloadKey] = snapshot.hasMany(key, {
            ids: true
          });
          // TODO support for polymorphic manyToNone and manyToMany relationships
        }

        window.Snapshot = snapshot;

        if (json.hasOwnProperty('entityTypeMap')){
          //snapshot._hasManyIds = json.entityTypeMap;
          json[key] = json.entityTypeMap;
        }
        console.log('key:');
        console.log(key);
        console.log('payloadKey:');
        console.log(payloadKey);
        console.log('snapshot:');
        console.log(snapshot);
        console.log('json:');
        console.log(json);
        console.log('relationship:');
        console.log(relationship);

      },


      normalizeSingleResponse: function(store, type, payload) {
        var included = [];

        if (payload && payload._embedded) {
          var _this = this;
          var forEachFunc = function(record) {
            console.log('normalize: relType:');
            console.log(relType);
            console.log('normalize: record:');
            console.log(record);
            //if (record.hasOwnProperty('polymorphicModelName')){
              //relType = store.modelFor(record.polymorphicModelName);
              //console.log('normalize: relType: Image?');
              //console.log(relType);
            //}
            //console.log('normalized:');
            //console.log(_this.normalize(relType, record).data);
            included.pushObject(_this.normalize(relType, record).data);
          };

          for (var relation in payload._embedded) {

            console.log('normalize: type:');
            console.log(type);

            console.log('normalize: relation:');
            console.log(relation);

            var relType = type.typeForRelationship(relation, store);

            var typeName = relType.modelName,
              embeddedPayload = payload._embedded[relation];

            if (embeddedPayload) {
              if (Ember.isArray(embeddedPayload)) {
                embeddedPayload.forEach(forEachFunc);
              } else {
                included.pushObject(this.normalize(relType, embeddedPayload).data);
              }
            }
          }

          delete payload._embedded;
        }

        var normalPayload = this.normalize(type, payload);
        if (included.length > 0) {
          normalPayload.included = included;
        }
        console.log('normalPayload:');
        console.log(normalPayload);
        return normalPayload;
      },


        normalizeArrayResponse: function(store, type, payload) {
          var response = {
            data: [],
            included: []
          };
          var _this = this;
          payload.forEach(function(json) {
            console.log('JSON:');
            console.log(json);
            var normalized = _this.normalizeSingleResponse(store, type, json);
            response.data.pushObject(normalized.data);

            if (normalized.included) {
              normalized.included.forEach(function(included) {
                if (!response.included.contains(included.id)) {
                  response.included.addObject(included);
                }
              });
            }
          });

          return response;
        }*/

});
