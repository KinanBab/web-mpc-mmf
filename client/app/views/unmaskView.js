/*eslint no-console: ["error", { allow: ["warn", "error"] }] */

define(['jquery', 'controllers/jiffController', 'controllers/tableController', 'controllers/analystController', 'helper/drop_sheet', 'alertHandler', 'table_template', 'spin', 'pki'],
  function ($, jiffController, tableController, analystController, DropSheet, alertHandler, table_template, Spinner, pki) {
    function error(msg) {
      alertHandler.error(msg);
    }

    function handle_file(event) {
      var f;

      var dropArea = document.getElementById('drop-area');
      var spinner = new Spinner().spin(dropArea);

      if (event.type === 'drop') {
        f = event.dataTransfer.files[0];
      } else if (event.type === 'change') {
        f = event.target.files[0];
      }

      if (f) {
        var keyReader = new FileReader();
        keyReader.readAsText(f);

        $(keyReader).on('load', function (e) {
          var sessionKey = $('#session').val();
          var sessionPass = $('#session-password').val();
          var privateKey = e.target.result;
          var progressBar = document.getElementById('unmask-progress-bar');

          // var client_keys = await analystController.getClientKeys(sessionKey, sessionPass);
          jiffController.analyst.computeAndFormat(sessionKey, sessionPass, privateKey, progressBar, error, function (result) {
            analystController.getExistingCohorts(sessionKey, sessionPass).then(function (cohortMapping) {
              analystController.getClientKeys(sessionKey, sessionPass).then(function (keyRequestResult) {
                var decryptPromises = [];
                for (client of keyRequestResult[1]) {
                  console.log(client);
                  decryptPromises.push(pki.decrypt(atob(client.key), pki.parsePrivateKey(privateKey)));
                }
                Promise.all(decryptPromises).then(function(values) {
                  console.log(values);
                  pki.encryptMessageWithSymmetricKey(values[0], "message", "associateddata"); // TODO FiX the message and AD
                });
              });

              tableController.saveTables(result['averages'], sessionKey, 'Averages', result['cohorts'], cohortMapping);
              tableController.saveTables(result['deviations'], sessionKey, 'Standard_Deviations', result['cohorts'], cohortMapping);
              
            });

            if (result['hasQuestions'] === true) {
              tableController.saveQuestions(result['questions'], sessionKey, result['cohorts']);
            }
            if (result['hasUsability'] === true) {
              tableController.saveUsability(result['usability'], sessionKey, result['cohorts']);
            }
            if(result['linearRegressions'] != null &&  !(Object.keys(result['linearRegressions']).length === 0)){
              tableController.saveLinearRegressions(result['linearRegressions'], sessionKey, result['cohorts'])
            }
            $('#tables-area').show();
            spinner.stop();

            //  display sums in the table
            tableController.createTableElems(table_template.tables, '#tables-area');
            tableController.displayReadTable(result['averages']['all'], 'sum');

            // display standard deviations in the table
            tableController.createTableElems(table_template.tables, '#tables-area-deviation');
            tableController.displayReadTable(result['deviations']['all'], 'deviation')
          });
        });
      }
    }

    function expandTable() {
      var expand_button = $('#expand-table-button');

      $(expand_button).click(function () {
        var ta = $('#tables-area');
        if (ta.css('display') === 'none') {
          ta.show();
        } else {
          ta.hide();
          tableController.resetTableWidth()
        }
      });
    }

    function unmaskView() {
      $(document).ready(function () {
        $('#tables-area').hide();
        expandTable();

        var _target = document.getElementById('drop-area');
        var _choose = document.getElementById('choose-file-button');

        DropSheet({
          drop: _target,
          choose: _choose,
          on: {},
          errors: {},
          handle_file: handle_file
        });
      });
    }

    return unmaskView;
  }
);
