function ControlViewModel(loginStateViewModel, settingsViewModel) {
    var self = this;

    self.loginState = loginStateViewModel;
    self.settings = settingsViewModel;

    self.isErrorOrClosed = ko.observable(undefined);
    self.isOperational = ko.observable(undefined);
    self.isPrinting = ko.observable(undefined);
    self.isPaused = ko.observable(undefined);
    self.isError = ko.observable(undefined);
    self.isReady = ko.observable(undefined);
    self.isLoading = ko.observable(undefined);
    self.x = ko.observable(undefined);
    self.y = ko.observable(undefined);
    self.z = ko.observable(undefined);
    self.position = {};

    self.extrusionAmount = ko.observable(undefined);
    self.controls = ko.observableArray([]);

    self.feedbackControlLookup = {};

    self.fromCurrentData = function(data) {
        self.x(data.position.x);
        self.y(data.position.y);
        self.z(data.position.z);
        self.position["X"] = data.position.x;
        self.position["Y"] = data.position.y;
        self.position["Z"] = data.position.z;
        self._processStateData(data.state);
    }

    self.fromHistoryData = function(data) {
        self._processStateData(data.state);
    }

    self._processStateData = function(data) {
        self.isErrorOrClosed(data.flags.closedOrError);
        self.isOperational(data.flags.operational);
        self.isPaused(data.flags.paused);
        self.isPrinting(data.flags.printing);
        self.isError(data.flags.error);
        self.isReady(data.flags.ready);
        self.isLoading(data.flags.loading);
    }

    self.fromFeedbackCommandData = function(data) {
        if (data.name in self.feedbackControlLookup) {
            self.feedbackControlLookup[data.name](data.output);
        }
    }

    self.requestData = function() {
        $.ajax({
            url: AJAX_BASEURL + "control/custom",
            method: "GET",
            dataType: "json",
            success: function(response) {
                self._fromResponse(response);
            }
        });
    }

    self._fromResponse = function(response) {
        self.controls(self._processControls(response.controls));
    }

    self._processControls = function(controls) {
        for (var i = 0; i < controls.length; i++) {
            controls[i] = self._processControl(controls[i]);
        }
        return controls;
    }

    self._processControl = function(control) {
        if (control.type == "parametric_command" || control.type == "parametric_commands") {
            for (var i = 0; i < control.input.length; i++) {
                control.input[i].value = control.input[i].default;
            }
        } else if (control.type == "feedback_command" || control.type == "feedback") {
            control.output = ko.observable("");
            self.feedbackControlLookup[control.name] = control.output;
        } else if (control.type == "section") {
            control.children = self._processControls(control.children);
        }
        return control;
    }

    self.sendJogCommand = function(axis, multiplier, distance) {
        if (typeof distance === "undefined")
            distance = $('#jog_distance button.active').data('distance');

        if (self.settings.getPrinterInvertAxis(axis)) {
            multiplier *= -1;
        }

        if (document.getElementById("fake-moves").checked) {
            axis = axis.toUpperCase();
            self.position[axis] = self.position[axis]  + distance * multiplier
            self.sendCustomCommand({type:'commands',commands:['G92 ' + axis + self.position[axis], 'M114']})
        } else {
            $.ajax({
                url: AJAX_BASEURL + "control/jog",
                type: "POST",
                dataType: "json",
                data: axis + "=" + ( distance * multiplier )
            })
        }
    }

    self.clickMove = function(x, y) {
        if (!document.getElementById("click-to-move").checked || self.isPrinting() && !self.isPaused())
            return false;

        self.position['X'] = x;
        self.position['Y'] = y;

        if (document.getElementById("fake-moves").checked)
            self.sendCustomCommand({type:'commands',commands:['G92 X' + x.toFixed(4) + ' Y' + y.toFixed(4), 'M114']})
        else
            $.ajax({
                url: AJAX_BASEURL + "control/jog",
                type: "POST",
                dataType: "json",
                data: {posX:x.toFixed(4), posY:y.toFixed(4)}
            })

        return true;
    }

    self.sendHomeCommand = function(axis) {
        if (document.getElementById("fake-moves").checked) {
            if(axis == 'XY') {
                self.position['X'] = 0
                self.position['Y'] = 0
                self.sendCustomCommand({type:'commands',commands:['G92 X0Y0', 'M114']})
            }
            if(axis == 'Z') {
                self.position['Z'] = 0
                self.sendCustomCommand({type:'commands',commands:['G92 Z0', 'M114']})
            }
        } else {
            $.ajax({
                url: AJAX_BASEURL + "control/jog",
                type: "POST",
                dataType: "json",
                data: "home" + axis
            })
        }
    }

    self.sendExtrudeCommand = function() {
        self._sendECommand(1);
    }

    self.sendRetractCommand = function() {
        self._sendECommand(-1);
    }

    self._sendECommand = function(dir) {
        var length = self.extrusionAmount();
        if (!length)
            length = 5;
        $.ajax({
            url: AJAX_BASEURL + "control/jog",
            type: "POST",
            dataType: "json",
            data: "extrude=" + (dir * length)
        })
    }

    self.sendCustomCommand = function(command) {
        if (!command)
            return;

        var data = undefined;
        if (command.type == "command" || command.type == "parametric_command" || command.type == "feedback_command") {
            // single command
            data = {"command" : command.command};
        } else if (command.type == "commands" || command.type == "parametric_commands") {
            // multi command
            data = {"commands": command.commands};
        }

        if (command.type == "parametric_command" || command.type == "parametric_commands") {
            // parametric command(s)
            data["parameters"] = {};
            for (var i = 0; i < command.input.length; i++) {
                data["parameters"][command.input[i].parameter] = command.input[i].value;
            }
        }

        if (!data)
            return;

        $.ajax({
            url: AJAX_BASEURL + "control/command",
            type: "POST",
            dataType: "json",
            contentType: "application/json; charset=UTF-8",
            data: JSON.stringify(data)
        })
    }

    self.displayMode = function(customControl) {
        switch (customControl.type) {
            case "section":
                return "customControls_sectionTemplate";
            case "command":
            case "commands":
                return "customControls_commandTemplate";
            case "parametric_command":
            case "parametric_commands":
                return "customControls_parametricCommandTemplate";
            case "feedback_command":
                return "customControls_feedbackCommandTemplate";
            case "feedback":
                return "customControls_feedbackTemplate";
            default:
                return "customControls_emptyTemplate";
        }
    }

}
