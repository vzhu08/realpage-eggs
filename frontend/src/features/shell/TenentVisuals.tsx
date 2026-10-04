import { Icon } from '../../components/Icon';

export function TenentMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 84 92" fill="none" aria-hidden="true"><path d="M7 81V27L42 9l35 18v54" stroke="currentColor" strokeWidth="1.7"/><path className="tenent-mark-letter" d="M23 34H61M42 34V73" stroke="currentColor" strokeWidth="4"/></svg>;
}

/** Editorial artwork is deliberately separate from the application's property data. */
export function TenentHero({ onFind, changesHref }: { onFind: () => void; changesHref: string }) {
  return <header className="tenent-hero">
    <div className="tenent-hero__art" aria-hidden="true"><img src="/assets/tenent-architecture.png" alt="" fetchPriority="high"/><div className="tenent-hero__shade"/>
      <svg className="tenent-hero__thread" viewBox="0 0 1200 530" preserveAspectRatio="none"><path d="M710 160C930 100 1090 180 1020 330S770 465 715 380"/></svg>
      <div className="source-float source-float--one"><span>STATE / CITY</span><Icon name="document" size={20}/><i/><i/><i/><small>Jurisdiction matters.</small></div>
      <div className="source-float source-float--two"><span>ORIGINAL SOURCE</span><div className="source-float__quote">§</div><i/><i/><small>The evidence stays attached.</small></div>
      <div className="tenent-hero__art-note">CONCEPTUAL ARCHITECTURE</div>
    </div>
    <div className="tenent-hero__copy">
      <p className="eyebrow"><span/> A CLEARER VIEW OF HOUSING LAW</p>
      <h1>One property.<br/>Many rules.<br/><em>A clearer answer.</em></h1>
      <p className="tenent-hero__lead">Understand what applies, follow the original sources, and see what still needs to be resolved.</p>
      <div className="tenent-hero__actions"><button type="button" className="button button--primary" onClick={onFind}>Find a property <Icon name="arrow" size={19}/></button><a className="tenent-hero__secondary" href={changesHref}>Explore changes <Icon name="arrow"/></a></div>
      <div className="tenent-hero__signals"><span><Icon name="document"/>Source-backed</span><span><Icon name="calendar"/>Date-aware</span><span><Icon name="layers"/>Open questions visible</span></div>
    </div>
  </header>;
}

export function ResearchGuide() {
  return <aside className="research-guide" aria-label="How TENENT works">
    <div className="research-guide__top"><TenentMark/><span>FROM PROPERTY<br/>TO PERSPECTIVE</span></div>
    <h3>A clear path.<br/>An open paper trail.</h3>
    <ol>{[
      ['01','Set the context','Choose a property and the date that matters.'],
      ['02','Resolve what you can','Answer questions that could change a result.'],
      ['03','Follow the evidence','Read the source, its limits, and the remaining gaps.'],
    ].map(([number,title,description])=><li key={number}><span>{number}</span><div><h4>{title}</h4><p>{description}</p></div></li>)}</ol>
    <div className="research-guide__foot"><Icon name="document"/> The words. The rule. The context.</div>
  </aside>;
}

export function ViewArtwork({ kind }: { kind: 'changes' | 'sources' }) {
  return <div className={`view-artwork view-artwork--${kind}`} aria-hidden="true"><div className="view-artwork__orbit"/>{kind === 'changes' ? <><div className="view-artwork__building"><Icon name="building" size={70}/></div><span className="view-artwork__point point-one"/><span className="view-artwork__point point-two"/><span className="view-artwork__point point-three"/><svg viewBox="0 0 300 150"><path d="M20 120H75L140 48H210L280 22"/><circle cx="75" cy="120" r="5"/><circle cx="140" cy="48" r="5"/><circle cx="210" cy="48" r="5"/></svg></> : <><div className="view-artwork__document doc-a"><Icon name="document" size={38}/><i/><i/><i/></div><div className="view-artwork__document doc-b"><span>§</span><i/><i/><i/></div><svg viewBox="0 0 300 150"><path d="M82 60C125 0 180 135 235 80"/></svg></>}</div>;
}
