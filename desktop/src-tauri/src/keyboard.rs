use enigo::{Direction, Enigo, Key, Keyboard, Settings};

pub fn compose_text(prefix: &str, barcode: &str, suffix: &str, auto_enter: bool, auto_tab: bool) -> String {
    let mut output = String::with_capacity(prefix.len() + barcode.len() + suffix.len() + 2);
    output.push_str(prefix);
    output.push_str(barcode);
    output.push_str(suffix);

    if auto_enter {
        output.push('\n');
    } else if auto_tab {
        output.push('\t');
    }

    output
}

pub fn type_scan(prefix: &str, barcode: &str, suffix: &str, auto_enter: bool, auto_tab: bool) -> Result<String, String> {
    let typed = compose_text(prefix, barcode, suffix, auto_enter, auto_tab);
    let mut enigo = Enigo::new(&Settings::default()).map_err(|error| error.to_string())?;

    let text = compose_text(prefix, barcode, suffix, false, false);
    enigo.text(&text).map_err(|error| error.to_string())?;

    if auto_enter {
        enigo.key(Key::Return, Direction::Click).map_err(|error| error.to_string())?;
    } else if auto_tab {
        enigo.key(Key::Tab, Direction::Click).map_err(|error| error.to_string())?;
    }

    Ok(typed)
}

#[cfg(test)]
mod tests {
    use super::compose_text;

    #[test]
    fn composes_text_with_enter() {
        assert_eq!(compose_text("AA", "123", "ZZ", true, false), "AA123ZZ\n");
    }

    #[test]
    fn composes_text_with_tab_when_enter_disabled() {
        assert_eq!(compose_text("", "123", "", false, true), "123\t");
    }
}
