export default function StarRating({ rating }) {
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
      <span className="stars-value">{rating.toFixed(1)}</span>
    </span>
  );
}
