(function($) {
  $.fn.conditionsBuilder = function(options) {
    if(options == "data") {
      var builder = $(this).eq(0).data("conditionsBuilder");
      return builder.collectData();
    } else {
      return $(this).each(function() {
        var builder = new ConditionsBuilder(this, options);
        $(this).data("conditionsBuilder", builder);
      });
    }
  };

  function ConditionsBuilder(element, options) {
    this.element = $(element);
    this.options = options || {};
    this.init();
  }

  ConditionsBuilder.prototype = {
    init: function() {
      var self = this
      this.fields = this.options.fields;
      this.data = this.options.data || {"all": []};
      this.onUpdate = function () {
        const data = self.collectData()
        self.options.onUpdate && self.options.onUpdate({ data: data })
      }  
      var rules = this.buildRules(this.data);
      this.element.html(rules);
    },

    collectData: function() {
      return this.collectDataFromNode(this.element.find("> .conditional"));
    },

    collectDataFromNode: function(element) {
      var klass = null;
      var _this = this;
      if(element.is(".conditional")) {
        klass = element.find("> .all-any-none-wrapper > .all-any-none").val();
      }

      if(klass) {
        var out = {};
        out[klass] = [];
        element.find("> .conditional, > .rule").each(function() {
          out[klass].push(_this.collectDataFromNode($(this)));
        });
        return out;
      }
      else {
        const entry = {
          name: element.find(".field").val(),
          operator: element.find(".operator").val(),
          value: element.find(".value").val()
        };
        if (element.hasClass("map-type")) {
          entry.key = element.find(".key").val()
        }
        return entry
      }
    },

    buildRules: function(ruleData) {
      return this.buildConditional(ruleData) || this.buildRule(ruleData);
    },

    buildConditional: function(ruleData) {
      var kind;
      if(ruleData.all) { kind = "all"; }
      else if(ruleData.any) { kind = "any"; }
      else if (ruleData.none) { kind = "none"; }
      if(!kind) { return; }

      var div = $("<div>", {"class": "conditional " + kind});
      var selectWrapper = $("<div>", {"class": "all-any-none-wrapper"});
      var select = $("<select>", {"class": "all-any-none"});
      select.append($("<option>", {"value": "all", "text": "All", "selected": kind == "all"}));
      select.append($("<option>", {"value": "any", "text": "Any", "selected": kind == "any"}));
      select.append($("<option>", {"value": "none", "text": "None", "selected": kind == "none"}));
      selectWrapper.append(select);
      selectWrapper.append($("<span>", {text: "of the following rules:"}));
      div.append(selectWrapper);

      var addRuleLink = $("<a>", {"href": "#", "class": "add-rule", "text": "Add Rule"});
      var _this = this;
      addRuleLink.click(function(e) {
        e.preventDefault();
        var f = _this.fields[0];
        var newField = {name: f.value, operator: f.operators[0], value: null};
        div.append(_this.buildRule(newField));
        _this.onUpdate()
      });
      div.append(addRuleLink);

      var addConditionLink = $("<a>", {"href": "#", "class": "add-condition", "text": "Add Sub-Condition"});
      addConditionLink.click(function(e) {
        e.preventDefault();
        var f = _this.fields[0];
        var newField = {"all": [{name: f.value, operator: f.operators[0], value: null}]};
        div.append(_this.buildConditional(newField));
        _this.onUpdate()
      });
      div.append(addConditionLink);

      var removeLink = $("<a>", {"class": "remove", "href": "#", "text": "Remove This Sub-Condition"});
      removeLink.click(function(e) {
        e.preventDefault();
        div.remove();
        _this.onUpdate()
      });
      div.append(removeLink);

      var rules = ruleData[kind];
      for(var i=0; i<rules.length; i++) {
        div.append(this.buildRules(rules[i]));
      }
      return div;
    },

    buildRule: function(ruleData) {
      const classes = ["rule"]
      const field = this.fieldFor(ruleData.name)
      if (field && field.type == "map") {
        classes.push("map-type")
      }
      var ruleDiv = $("<div>", {class: classes.join(" ")});
      var fieldSelect = getFieldSelect(this.fields, ruleData);
      var keyField = getKeyField(field, ruleData)
      var operatorSelect = getOperatorSelect(this);
      var self = this
      var onChangeFunc = onFieldSelectChanged.call(self, operatorSelect, ruleData)  
      fieldSelect.change(function (e) {
        onChangeFunc(e)
      });
  
      ruleDiv.append(fieldSelect);
      if (keyField) {
        ruleDiv.append(keyField)
      }
      ruleDiv.append(operatorSelect);
      ruleDiv.append(removeLink(this));

      fieldSelect.change();
      ruleDiv.find("> .value").val(ruleData.value);
      return ruleDiv;
    },

    operatorsFor: function(fieldName) {
      for(var i=0; i < this.fields.length; i++) {
        var field = this.fields[i];
        if(field.name == fieldName) {
          return field.operators;
        }
      }
    },

    fieldFor: function(name) {
      return this.fields.find(field => field.name == name)
    }
  };

  function getFieldSelect(fields, ruleData) {
    var select = $("<select>", {"class": "field"});
    for(var i=0; i < fields.length; i++) {
      var field = fields[i];
      var option = $("<option>", {
        text: field.label, 
        value: field.name, 
        selected: ruleData.name == field.name
      });
      option.data("options", field.options);
      select.append(option);
    }
    return select;
  }

  function getKeyField(field, ruleData) {
    var inputField 
    if (field.type == 'map') {
      if (field.options && field.options.length) {
        inputField = $("<select>", {"class": "field key"});
        for(var i=0; i < field.options.length; i++) {
          var option = field.options[i];
          var optionDom = $("<option>", {
            text: option.label, 
            value: option.name, 
            selected: ruleData.key == option.name
          });
          inputField.append(optionDom);
        }
      } else {
        inputField = $("<input>",{ name: "key", class: "field key", value: ruleData.key })
      }
    }
    return inputField
  }

  function getOperatorSelect(self) {
    var select = $("<select>", {"class": "operator"});
    select.change(function (e) {
      onOperatorSelectChange.bind(this)(e, self)
    });
    return select;
  }

  function removeLink(self) {
    var removeLink = $("<button>", {"class": "remove", "href": "#", "text": "Remove"});
    removeLink.click(function (e) {
      onRemoveLinkClicked.bind(this)(e)
      self.onUpdate()
    });
    return removeLink;
  }

  function onRemoveLinkClicked(e) {
    e.preventDefault();
    $(this).parents(".rule").remove();
  }

  function onFieldSelectChanged(operatorSelect, ruleData) {
    var builder = this;
    return function(e) {
      var operators = builder.operatorsFor($(e.target).val());
      operatorSelect.empty();
      for(var i=0; i < operators.length; i++) {
        var operator = operators[i];
        var option = $("<option>", {
          text: operator.label || operator.name, 
          value: operator.name, 
          selected: ruleData.operator == operator.name
        });
        option.data("fieldType", operator.fieldType);
        operatorSelect.append(option);
      }
      operatorSelect.change();
      const container = operatorSelect.parents(".rule")
      const field = builder.fieldFor(container.find(".field").val())
      if (field.type == "map") {
        container.find('.field.key').replaceWith(getKeyField(field, ruleData))
      } else {
        container.find('.field.key').delete()
      }

      if (field && field.type == "map") {
        container.addClass("map-type")
      } else {
        container.removeClass("map-type")
      }
    }
  }

  function onOperatorSelectChange(e, self) {
    var $this = $(this);
    var option = $this.find("> :selected");
    var container = $this.parents(".rule");
    var fieldSelect = container.find(".field");
    var currentValue = container.find(".value");
    var val = currentValue.val();

    switch(option.data("fieldType")) {
      case "none": 
        $this.after($("<input>", {"type": "hidden", "class": "value"}));
        break;
      case "text":
        const input = $("<input>", { "type": "text", "class": "value" })
        $this.after(input);
        input.change(() => {
          self.onUpdate()
        })
        break;
      case "textarea":
        const textArea = $("<textarea>", { "class": "value" })
        $this.after(textArea);
        textArea.change(() => {
          self.onUpdate()
        })
      case "select":
        var select = $("<select>", {"class": "value"});
        var options = fieldSelect.find("> :selected").data("options");
        for(var i=0; i < options.length; i++) {
          var opt = options[i];
          select.append($("<option>", {"text": opt.label || opt.name, "value": opt.name}));
        }
        $this.after(select);
        select.change(() => {
          self.onUpdate()
        });  
        break;
    }
    currentValue.remove();
    self.onUpdate()
  }

})(jQuery);
