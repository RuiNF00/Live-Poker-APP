// The «Aceito» sheet (design/aceito-ugc/): asked once, before the first comment, the first public
// hand link and turning the public profile on. Each screen renders its own sheet, so it opens over
// that screen even when the screen is itself a modal. Closing it publishes nothing.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { Sheet } from "@/components/BankrollSheets";
import { Button, T } from "@/components/ui";
import { t, variant, type Variant } from "@/i18n";
import { onEraseAll } from "@/lib/erase-hooks";
import { ugcTerms } from "@/lib/ugc-terms";
import { C, S } from "@/theme";

const gate = ugcTerms(AsyncStorage);
onEraseAll(() => gate.forget());

/** The Terms opened at «Your content», in the player's language (web/public/terms.html). */
const CONTENT_ANCHOR: Record<Variant, string> = {
  en: "#content",
  "pt-PT": "#pt-conteudo",
  "pt-BR": "#pt-br-conteudo",
  es: "#es-contenido",
};
const TERMS = "https://sweatbook.poker/terms.html";

/** [the sheet to render, accept]: accept resolves true at once when already accepted, else after «Aceito». */
export function useUgcTerms(): [React.ReactNode, () => Promise<boolean>] {
  const [open, setOpen] = useState(false);
  const done = useRef<((ok: boolean) => void) | null>(null);

  const accept = useCallback(
    () =>
      gate.accept(
        () =>
          new Promise<boolean>((resolve) => {
            done.current = resolve;
            // A share sheet that called this may still be closing: one modal at a time on iOS.
            setTimeout(() => setOpen(true), 350);
          }),
      ),
    [],
  );

  const finish = (ok: boolean) => {
    setOpen(false);
    done.current?.(ok);
    done.current = null;
  };

  const sheet = (
    <Sheet
      visible={open}
      title={t("Antes de publicares")}
      onClose={() => finish(false)}
      footer={
        <View style={{ gap: S.sm }}>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              void WebBrowser.openBrowserAsync(
                TERMS + CONTENT_ANCHOR[variant],
              ).catch(() => {})
            }
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <T v="small" color={C.textDim} style={{ textAlign: "center" }}>
              {t("Ao aceitar, concordas com os")}{" "}
              <T
                v="small"
                color={C.accent}
                style={{ textDecorationLine: "underline" }}
              >
                {t("Termos de utilização")}
              </T>
            </T>
          </Pressable>
          <Button title={t("Aceito")} onPress={() => finish(true)} />
        </View>
      }
    >
      <T v="callout">
        {t(
          "Os teus comentários, as mãos que partilhas e o teu perfil público podem ser vistos por outras pessoas.",
        )}
      </T>
      <T v="callout">
        {t(
          "Temos tolerância zero para conteúdo ofensivo e abusos. Podes denunciar ou bloquear quem o fizer. Nós retiramos esse conteúdo e afastamos quem o publicou.",
        )}
      </T>
      <T v="small" color={C.textDim}>
        {t("Só te perguntamos uma vez.")}
      </T>
    </Sheet>
  );
  return [sheet, accept];
}
