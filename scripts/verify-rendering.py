import json, pathlib
from playwright.sync_api import sync_playwright

HTML_PATH = pathlib.Path(r"C:\Users\kesha\webcampus\debug-ssr.html")
OUTPUT_DIR = pathlib.Path(r"C:\Users\kesha\webcampus")

def measure(page):
    return page.evaluate("""() => {
        const pageDiv = document.querySelector('body > div');
        if (!pageDiv) return { error: 'no page div' };
        const pageRect = pageDiv.getBoundingClientRect();
        const pageCs = getComputedStyle(pageDiv);

        // Helper: find a div by partial text match
        function findDivByText(container, text, maxDepth=10) {
            const walker = document.createTreeWalker(container, 4 /* SHOW_TEXT */, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(text)) {
                    let el = node.parentElement;
                    // Walk up to find the outermost relevant container
                    for (let i = 0; i < 5 && el && el.parentElement !== container; i++) {
                        if (el.parentElement && el.parentElement !== container && el.parentElement.parentElement === container) break;
                        el = el.parentElement;
                    }
                    return el;
                }
            }
            return null;
        }

        // === HEADER ROW (first child of page that is a flex row) ===
        const headerFlex = pageDiv.children[1]; // skip preload <link>
        const headerRect = headerFlex ? headerFlex.getBoundingClientRect() : null;
        const headerCs = headerFlex ? getComputedStyle(headerFlex) : null;

        // === LOGO ===
        const logo = pageDiv.querySelector('img[alt="BMSCE"]');
        const logoRect = logo ? logo.getBoundingClientRect() : null;

        // === QR ===
        const qr = pageDiv.querySelector('img[alt="QR"]');
        const qrRect = qr ? qr.getBoundingClientRect() : null;

        // === STUDENT INFO BOX (the grid div) ===
        const infoGrid = Array.from(pageDiv.querySelectorAll('div')).find(d =>
            d.textContent?.includes('USN') && d.textContent?.includes('Name') && d.children.length > 4
        );
        const infoRect = infoGrid ? infoGrid.getBoundingClientRect() : null;
        const infoCs = infoGrid ? getComputedStyle(infoGrid) : null;

        // === PHOTO BOX ===
        const photoBox = Array.from(pageDiv.querySelectorAll('div')).find(d =>
            d.textContent?.trim() === 'Photo' && d.children.length === 0
        );
        const photoContainer = photoBox ? photoBox.parentElement : null;
        const photoRect = photoContainer ? photoContainer.getBoundingClientRect() : null;

        // === STUDENT INFO SECTION (the flex row containing grid + photo) ===
        const infoSection = infoGrid ? infoGrid.parentElement : null;
        const infoSectionRect = infoSection ? infoSection.getBoundingClientRect() : null;
        const infoSectionCs = infoSection ? getComputedStyle(infoSection) : null;

        // === TABLE ===
        const table = pageDiv.querySelector('table');
        const tableRect = table ? table.getBoundingClientRect() : null;
        const tableCs = table ? getComputedStyle(table) : null;

        // === TABLE COLUMNS ===
        const ths = table ? table.querySelectorAll('thead th') : [];
        const colWidths = Array.from(ths).map((th, i) => ({
            index: i,
            text: th.textContent?.trim(),
            width: th.getBoundingClientRect().width,
            csWidth: getComputedStyle(th).width,
        }));

        const rows = table ? table.querySelectorAll('tbody tr') : [];
        // Get first data row cell widths for comparison
        const firstRowCells = rows.length > 0 ? rows[0].querySelectorAll('td') : [];
        const dataColWidths = Array.from(firstRowCells).map((td, i) => ({
            index: i,
            text: td.textContent?.trim().substring(0, 20),
            width: td.getBoundingClientRect().width,
        }));

        // === SIGNATURE SECTION ===
        const sigSection = Array.from(pageDiv.querySelectorAll('div')).find(d => {
            const text = d.textContent || '';
            return text.includes('Candidate') && text.includes('Controller') && text.includes('Seal');
        });
        const sigRect = sigSection ? sigSection.getBoundingClientRect() : null;
        const sigCs = sigSection ? getComputedStyle(sigSection) : null;

        // Signature sub-items
        const sigChildren = sigSection ? Array.from(sigSection.children).map(c => ({
            text: c.textContent?.substring(0, 30),
            width: c.getBoundingClientRect().width,
            top: c.getBoundingClientRect().top - pageRect.top,
        })) : [];

        // === INSTRUCTIONS ===
        const instr = Array.from(pageDiv.querySelectorAll('div')).find(d => {
            const text = d.textContent || '';
            return text.includes('INSTRUCTIONS') && text.includes('CANDIDATES') && d.children.length > 3;
        });
        const instrRect = instr ? instr.getBoundingClientRect() : null;
        const instrCs = instr ? getComputedStyle(instr) : null;

        // === FOOTER ===
        const footer = Array.from(pageDiv.querySelectorAll('div')).find(d =>
            d.textContent?.includes('computer-generated') && d.children.length === 0
        );
        const footerRect = footer ? footer.getBoundingClientRect() : null;

        // Student info grid items
        const gridItems = infoGrid ? Array.from(infoGrid.children).map(c => ({
            text: c.textContent?.trim().substring(0, 25),
            width: c.getBoundingClientRect().width,
            fontSize: getComputedStyle(c).fontSize,
            fontWeight: getComputedStyle(c).fontWeight,
        })) : [];

        return {
            page: {
                width: pageRect.width,
                height: pageRect.height,
                padding: pageCs.padding,
                boxSizing: pageCs.boxSizing,
            },
            header: headerRect ? {
                top: Math.round(headerRect.top - pageRect.top),
                height: Math.round(headerRect.height),
                bottom: Math.round(headerRect.bottom - pageRect.top),
                borderBottom: headerCs?.borderBottom,
                marginBottom: headerCs?.marginBottom,
                gap: headerCs?.gap,
            } : null,
            logo: logoRect ? {
                width: Math.round(logoRect.width),
                height: Math.round(logoRect.height),
                top: Math.round(logoRect.top - pageRect.top),
            } : null,
            qr: qrRect ? {
                width: Math.round(qrRect.width),
                height: Math.round(qrRect.height),
                top: Math.round(qrRect.top - pageRect.top),
            } : null,
            studentInfoSection: infoSectionRect ? {
                width: Math.round(infoSectionRect.width),
                height: Math.round(infoSectionRect.height),
                top: Math.round(infoSectionRect.top - pageRect.top),
                padding: infoSectionCs?.padding,
                border: infoSectionCs?.border,
                gap: infoSectionCs?.gap,
            } : null,
            studentInfoGrid: infoRect ? {
                width: Math.round(infoRect.width),
                height: Math.round(infoRect.height),
                top: Math.round(infoRect.top - pageRect.top),
                gridTemplateColumns: infoCs?.gridTemplateColumns,
                columnGap: infoCs?.columnGap,
                rowGap: infoCs?.rowGap,
                fontSize: infoCs?.fontSize,
            } : null,
            studentPhoto: photoRect ? {
                width: Math.round(photoRect.width),
                height: Math.round(photoRect.height),
                top: Math.round(photoRect.top - pageRect.top),
                cssWidth: getComputedStyle(photoContainer).width,
                cssHeight: getComputedStyle(photoContainer).height,
                border: getComputedStyle(photoContainer).border,
            } : null,
            gridLabels: gridItems.filter(i => i.text.endsWith(':')),
            table: tableRect ? {
                width: Math.round(tableRect.width),
                height: Math.round(tableRect.height),
                top: Math.round(tableRect.top - pageRect.top),
                left: Math.round(tableRect.left - pageRect.left),
                borderCollapse: tableCs?.borderCollapse,
                fontSize: tableCs?.fontSize,
                colCount: ths.length,
                rowCount: rows.length,
            } : null,
            columnWidths: colWidths.map(c => ({ index: c.index, text: c.text, width: Math.round(c.width) })),
            dataColumnWidths: dataColWidths.map(c => ({ index: c.index, text: c.text, width: Math.round(c.width) })),
            signatureSection: sigRect ? {
                top: Math.round(sigRect.top - pageRect.top),
                height: Math.round(sigRect.height),
                bottom: Math.round(sigRect.bottom - pageRect.top),
            } : null,
            signatureItems: sigChildren,
            instructions: instrRect ? {
                top: Math.round(instrRect.top - pageRect.top),
                height: Math.round(instrRect.height),
                bottom: Math.round(instrRect.bottom - pageRect.top),
                fontSize: instrCs?.fontSize,
            } : null,
            footer: footerRect ? {
                top: Math.round(footerRect.top - pageRect.top),
                height: Math.round(footerRect.height),
                bottom: Math.round(footerRect.bottom - pageRect.top),
            } : null,
            totalContentBottom: footerRect ? Math.round(footerRect.bottom - pageRect.top) : null,
        };
    }""")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use A4 viewport for accuracy
        page = browser.new_page(viewport={"width": 794, "height": 1123})

        file_url = HTML_PATH.resolve().as_uri()
        page.goto(file_url)
        page.wait_for_load_state("networkidle")

        ss_path = OUTPUT_DIR / "debug-ssr-screen.png"
        page.screenshot(path=str(ss_path), full_page=True)
        print(f"Screenshot: {ss_path}")

        result = measure(page)
        print(json.dumps(result, indent=2, default=str))

        json_path = OUTPUT_DIR / "debug-ssr-measurements.json"
        json_path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
        print(f"Measurements: {json_path}")

        browser.close()

if __name__ == "__main__":
    main()
