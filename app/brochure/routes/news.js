var Express = require("express");
var news = new Express.Router();
var moment = require("moment");
var exec = require("child_process").exec;
var fs = require("fs-extra");
var marked = require("marked");
var helper = require("helper");
var parse = require("body-parser").urlencoded({ extended: false });
var uuid = require("uuid/v4");
var config = require("config");
var client = require("client");

var listKey = "newsletter:list";
var TTL = 60 * 60 * 24; // 1 day in seconds

news.get("/", loadDone, loadToDo, function(req, res) {
  res.render("about/news");
});

// The rest of these pages should not be cached
news.use(function (req, res, next) {
  res.header("Cache-Control", "no-cache");
  next();
});

news.get("/sign-up", function (req, res) {
  if (req.session && req.session.newsletter_email) {
    res.locals.email = req.session.newsletter_email;
    delete req.session.newsletter_email;
  } else {
    return res.redirect(req.baseUrl);
  }

  res.render("about/news/sign-up");
});

news.get("/cancel", function (req, res) {
  if (req.session && req.session.newsletter_email) {
    res.locals.email = req.session.newsletter_email;
    delete req.session.newsletter_email;
  }

  res.render("about/news/cancel");
});

function confirmationKey(guid) {
  return "newsletter:confirm:" + guid;
}

function cancellationKey(guid) {
  return "newsletter:cancel:" + guid;
}

function confirmationLink(guid) {
  return "https://" + config.host + "/about/news/confirm/" + guid;
}

function cancellationLink(guid) {
  return "https://" + config.host + "/about/news/cancel/" + guid;
}

// Removes guid from visible breadcrumbs
news.param("guid", function (req, res, next) {
  res.locals.breadcrumbs = res.locals.breadcrumbs.slice(0, -1);
  next();
});

news.post("/cancel", parse, function (req, res, next) {
  var cancel, email, locals;
  var guid = uuid();

  if (!req.body || !req.body.email) {
    return next(new Error("No email"));
  }

  email = req.body.email.trim().toLowerCase();
  guid = guid.split("-").join("");
  guid = encodeURIComponent(guid);
  cancel = cancellationLink(guid);
  locals = { email: email, cancel: cancel };

  client.sismember(listKey, email, function (err, stat) {
    if (err || !stat) return next(err || new Error("No subscription found"));

    client.setex(cancellationKey(guid), TTL, email, function (err) {
      if (err) return next(err);

      helper.email.NEWSLETTER_CANCELLATION_CONFIRMATION(null, locals, function (
        err
      ) {
        if (err) return next(err);

        req.session.newsletter_email = email;
        res.redirect("/about/news/cancel");
      });
    });
  });
});

news.get("/cancel/:guid", function (req, res, next) {
  var guid = decodeURIComponent(req.params.guid);

  client.get(cancellationKey(guid), function (err, email) {
    if (err || !email) return next(err || new Error("No email"));

    client.srem(listKey, email, function (err, removed) {
      if (err) return next(err);

      var locals = { email: email };

      res.locals.title = "Cancelled";
      res.locals.email = email;
      res.render("about/news/cancelled");

      if (removed) {
        helper.email.NEWSLETTER_CANCELLATION_CONFIRMED(
          null,
          locals,
          function () {
            // Email confirmation sent
          }
        );
      }

    });
  });
});

news.get("/confirm/:guid", function (req, res, next) {
  var guid = decodeURIComponent(req.params.guid);

  client.get(confirmationKey(guid), function (err, email) {
    if (err || !email) return next(err || new Error("No email"));

    client.sadd(listKey, email, function (err, added) {
      if (err) return next(err);

      var locals = {
        email: email,
        cancel: "https://" + config.host + "/news/cancel",
      };

      res.locals.title = "Confirmed";
      res.locals.email = email;
      res.render("about/news/confirmed");

      // The first time the user clicks the confirmation
      // link we send out a confirmation email, subsequent
      // clicks they just see the confirmation page.
      if (added) {
        helper.email.NEWSLETTER_SUBSCRIPTION_CONFIRMED(
          null,
          locals,
          function () {
            // Email confirmation sent
          }
        );
      }
    });
  });
});

news.post("/sign-up", parse, function (req, res, next) {
  var confirm, email, locals;
  var guid = uuid();

  if (!req.body || !req.body.email) {
    return next(new Error("No email"));
  }

  email = req.body.email.trim().toLowerCase();
  guid = guid.split("-").join("");
  guid = encodeURIComponent(guid);
  confirm = confirmationLink(guid);
  locals = { email: email, confirm: confirm };

  client.setex(confirmationKey(guid), TTL, email, function (err) {
    if (err) return next(err);

    helper.email.NEWSLETTER_SUBSCRIPTION_CONFIRMATION(null, locals, function (
      err
    ) {
      if (err) return next(err);

      req.session.newsletter_email = email;
      res.redirect("/about/news/sign-up");
    });
  });
});

function loadToDo(req, res, next) {
  fs.readFile(__dirname + "/../../../todo.txt", "utf-8", function (err, todo) {
    if (err) return next(err);
    res.locals.todo = marked(todo);

    var html = res.locals.todo;
    var $ = require("cheerio").load(html);

    $("ul").each(function () {
      var ul = $(this).html();
      var p = $(this).prev().html();

      $(this).prev().remove();
      $(this).replaceWith(
        "<details><summary>" + p + "</summary><ul>" + ul + "</ul></details>"
      );
    });

    res.locals.todo = $.html();
    return next();
  });
}

function loadDone(req, res, next) {
  exec("git log -100", { cwd: helper.rootDir }, function (err, output) {
    if (err) return next(err);

    output = output.split("\n\n");

    var commits = [];

    output.forEach(function (item, i) {
      if (i % 2 === 0) {
        var message = output[i + 1].trim();

        message = message[0].toUpperCase() + message.slice(1);

        // Ignores merge commits since they're not useful to readers
        if (message.split(" ").join("").toLowerCase().indexOf("merge") > -1)
          return;

        // Ignores commits mentioning 'commit' since they're not useful to readers
        if (message.split(" ").join("").toLowerCase().indexOf("commit") > -1)
          return;

        // Ignores commits to todo file since there are so many of them
        if (message.split(" ").join("").toLowerCase().indexOf("todo") > -1)
          return;

        // Ignores commits with links since they're ugly
        if (message.split(" ").join("").toLowerCase().indexOf("://") > -1)
          return;

        commits.push({
          author: item
            .slice(
              item.indexOf("Author:") + "Author:".length,
              item.indexOf("<")
            )
            .trim(),
          date: moment(
            new Date(item.slice(item.indexOf("Date:") + "Date:".length).trim())
          ).fromNow(),
          hash: item
            .slice(
              item.indexOf("commit ") + "commit ".length,
              item.indexOf("Author")
            )
            .trim(),
          message: message,
        });
      }
    });

    res.locals.commits = commits;
    next();
  });
}

module.exports = news;
